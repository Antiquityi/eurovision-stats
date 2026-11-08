import { describe, expect, it, vi } from 'vitest';
import { createContestService } from '../../../src/services/contests.js';
import { createRealtimeService } from '../../../src/services/realtime.js';

function sdk(result) {
    const query = {};
    for (const method of ['select', 'eq', 'update', 'order']) query[method] = vi.fn(() => query);
    query.single = vi.fn().mockResolvedValue(result);
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return { query, client: { from: vi.fn(() => query) } };
}

describe('contest SDK boundary', () => {
    it('saves combined entry details through the approved-editor RPC, including clearing', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: 'Artysta — Utwór', error: null });
        const service = createContestService({ rpc });
        expect(await service.saveEntryDetails('c', 'e', '  Artysta — Utwór ')).toBe('Artysta — Utwór');
        expect(rpc).toHaveBeenLastCalledWith('set_entry_details', { p_contest_id: 'c', p_entry_id: 'e', p_artist_song: 'Artysta — Utwór' });
        await service.saveEntryDetails('c', 'e', '');
        expect(rpc).toHaveBeenLastCalledWith('set_entry_details', { p_contest_id: 'c', p_entry_id: 'e', p_artist_song: '' });
        await expect(service.saveEntryDetails('c', 'e', 'x'.repeat(201))).rejects.toThrow();
        expect(rpc).toHaveBeenCalledTimes(2);
        rpc.mockResolvedValueOnce({ error: new Error('denied') });
        await expect(service.saveEntryDetails('c', 'e', 'Song')).rejects.toThrow('denied');
    });
    it('saves or resets a tie through the permission-checked RPC', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        const service = createContestService({ rpc });
        await service.resolveTie('year', { scope: 'v', score: 6.5, entryIds: ['b', 'a'] });
        expect(rpc).toHaveBeenLastCalledWith('resolve_podium_tie', {
            p_contest_id: 'year', p_scope: 'v', p_score: 6.5, p_entry_ids: ['b', 'a'], p_reset: false,
        });
        rpc.mockResolvedValueOnce({ data: null, error: new Error('Denied') });
        await expect(service.resolveTie('year', { scope: 'total', score: 6.5, entryIds: ['b', 'a'], reset: true })).rejects.toThrow('Denied');
    });
    it('uses the permission-checked RPC for person changes and validates names', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: 'new-id', error: null });
        const service = createContestService({ rpc });
        expect(await service.manageVoter('c', { action: 'add', name: '  Łukasz  ' })).toBe('new-id');
        expect(rpc).toHaveBeenLastCalledWith('manage_voter', { p_contest_id: 'c', p_action: 'add', p_voter_id: null, p_name: 'Łukasz' });
        await service.manageVoter('c', { action: 'delete', voterId: 'v' });
        expect(rpc).toHaveBeenLastCalledWith('manage_voter', { p_contest_id: 'c', p_action: 'delete', p_voter_id: 'v', p_name: null });
        for (const name of ['', '   ', 'x'.repeat(81), null]) await expect(service.manageVoter('c', { action: 'rename', voterId: 'v', name })).rejects.toThrow();
        expect(rpc).toHaveBeenCalledTimes(2);
        rpc.mockResolvedValueOnce({ data: null, error: new Error('denied') });
        await expect(service.manageVoter('c', { action: 'rename', voterId: 'v', name: 'Anna' })).rejects.toThrow('denied');
    });
    it('maps public rows including the combined artist/song field and orders voters', async () => {
        const { query, client } = sdk({ data: { id: 'c', year: 2026, title: 'Eurowizja 2026',
            voters: [{ id: 'b', position: 2 }, { id: 'a', position: 1 }],
            entries: [{ id: 'e', order: 1, country_code: 'PL', country_name: 'Polska', artist_song: 'Artist — Song' }], ratings: [] }, error: null });
        const contest = await createContestService(client).getContest('c');
        expect(query.eq).toHaveBeenCalledWith('id', 'c');
        expect(contest.voters.map(voter => voter.id)).toEqual(['a', 'b']);
        expect(contest.entries).toEqual([{ id: 'e', order: 1, countryCode: 'PL', countryName: 'Polska', artistSong: 'Artist — Song', ratings: { a: null, b: null } }]);
        expect(query.select.mock.calls[0][0]).toContain('artist_song');
    });
    it('updates only one pair and value, returning the authoritative revision; rejects invalid inputs', async () => {
        const result = { entry_id: 'e', voter_id: 'v', value: 0, revision: 9 };
        const { query, client } = sdk({ data: result, error: null });
        const service = createContestService(client);
        expect(await service.saveRating('e', 'v', 0)).toEqual(result);
        expect(query.update).toHaveBeenCalledExactlyOnceWith({ value: 0 });
        expect(query.eq.mock.calls).toEqual([['entry_id', 'e'], ['voter_id', 'v']]);
        await expect(service.saveRating('e', 'v', 7.2)).rejects.toThrow();
        expect(query.update).toHaveBeenCalledTimes(1);
        await service.saveRating('e', 'v', null);
        expect(query.update).toHaveBeenLastCalledWith({ value: null });
    });
    it('propagates empty-row/RLS/service errors instead of acknowledging an unsaved value', async () => {
        const { client } = sdk({ data: null, error: new Error('denied') });
        const service = createContestService(client);
        await expect(service.saveRating('e', 'v', 7)).rejects.toThrow('denied');
        await expect(service.getContest('c')).rejects.toThrow('denied');
        await expect(service.listContests()).rejects.toThrow('denied');
    });
});

it('scopes rating events to the active contest and disposes only its channel', () => {
    const handlers = [];
    let notify;
    const channel = { on: vi.fn((kind, config, callback) => { handlers.push({ kind, config, callback }); return channel; }),
        subscribe: vi.fn(callback => { notify = callback; }) };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const callbacks = { rating: vi.fn(), contests: vi.fn(), status: vi.fn() };
    const stop = createRealtimeService(client).subscribe('c', callbacks);
    expect(handlers.slice(0, 2).map(handler => handler.config)).toEqual(['INSERT', 'UPDATE'].map(event => ({ event, schema: 'public', table: 'ratings', filter: 'contest_id=eq.c' })));
    handlers[0].callback({ new: { revision: 3 } }); notify('SUBSCRIBED');
    expect(callbacks.rating).toHaveBeenCalledWith({ revision: 3 });
    expect(callbacks.status).toHaveBeenCalledWith('SUBSCRIBED');
    stop();
    handlers[1].callback({ new: { revision: 4 } }); notify('CLOSED');
    expect(callbacks.rating).toHaveBeenCalledTimes(1);
    expect(callbacks.status).toHaveBeenCalledTimes(1);
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
});

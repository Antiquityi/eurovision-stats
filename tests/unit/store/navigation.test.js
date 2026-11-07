import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createScoreboardStore } from '../../../src/store/index.js';
import { authRedirectUrl } from '../../../src/services/auth.js';

const stores = [];
afterEach(async () => { for (const store of stores.splice(0)) await store.dispatch('contests/stop'); window.history.replaceState(null, '', '/'); });
async function live(options = {}) {
    const list = options.list ?? [{ id: 'old', year: 2025, title: 'Eurowizja 2025' }, { id: 'new', year: 2026, title: 'Eurowizja 2026' }];
    const callbacks = [];
    const service = { listContests: vi.fn(async () => [...list]), getContest: vi.fn(async id => ({ ...list.find(c => c.id === id),
        voters: [{ id: id + '-v', name: 'A' }], entries: [{ id: id + '-e', order: 1, countryCode: 'PL', countryName: 'Polska', ratings: { [id + '-v']: null } }], ratings: [] })) };
    const realtime = { subscribe: vi.fn((_id, cb) => { callbacks.push(cb); queueMicrotask(() => cb.status('SUBSCRIBED')); return vi.fn(); }) };
    const store = createScoreboardStore([], { selectedYear: '2025', ...options, auth: { configured: true }, service, realtime }); stores.push(store);
    await store.dispatch('contests/start'); await flushPromises(); store.commit('auth/access', true);
    return { store, service, callbacks, list };
}
describe('year navigation', () => {
    it('distinguishes named contests in one year through reload, navigation and draft state', async () => {
        const list = [{ id: 'asia', year: 2026, title: '2026 ASIA' }, { id: 'main', year: 2026, title: 'Eurowizja 2026' }];
        const { store } = await live({ list, selectedYear: '2026', selectedContestId: 'asia' });
        expect(store.state.contests.active.id).toBe('asia');
        await store.dispatch('contests/draft', { entryId: 'asia-e', voterId: 'asia-v', text: '9' });
        await store.dispatch('contests/select', 'main'); await flushPromises();
        expect(new URL(window.location.href).searchParams.get('contest')).toBe('main');
        expect(store.state.contests.active.entries[0].ratings).toEqual({ 'main-v': null });
        window.history.replaceState(null, '', '/?year=2026&contest=asia');
        window.dispatchEvent(new Event('popstate')); await flushPromises();
        expect(store.state.contests.active.id).toBe('asia');
        expect(store.state.contests.drafts['asia-e:asia-v']).toBe('9');
        const legacy = await live({ list, selectedYear: '2026' });
        expect(legacy.store.state.contests.active.id).toBe('main');
    });
    it('honors a query, sorts newest first, preserves selection in OAuth and follows browser navigation', async () => {
        const { store } = await live();
        expect(store.state.contests.active.id).toBe('old');
        expect(store.state.contests.list.map(c => c.year)).toEqual([2026, 2025]);
        await store.dispatch('contests/draft', { entryId: 'old-e', voterId: 'old-v', text: '9' });
        await store.dispatch('contests/select', 'new'); await flushPromises();
        expect(new URL(window.location.href).searchParams.get('year')).toBe('2026');
        expect(authRedirectUrl(window.location.href, '/', store.state.contests.active.year)).toContain('year=2026');
        expect(store.state.contests.active.entries[0].ratings).toEqual({ 'new-v': null });
        expect(store.state.contests.drafts).toEqual({ 'old-e:old-v': '9' });
        window.history.replaceState(null, '', '/?year=2025'); window.dispatchEvent(new Event('popstate')); await flushPromises();
        expect(store.state.contests.active.id).toBe('old');
        expect(store.state.contests.drafts['old-e:old-v']).toBe('9');
    });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScoreboardStore } from '../../../src/store/index.js';
import { createPreviewContests } from '../../fixtures/scoreboard.js';

const session = id => ({ user: { id, user_metadata: { user_name: id } }, access_token: 'private' });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const stores = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function setup(options = {}) {
    let notify;
    const unsubscribe = vi.fn();
    const service = {
        subscribe: vi.fn(callback => { notify = callback; return unsubscribe; }),
        getSession: vi.fn().mockResolvedValue(null),
        isEditor: vi.fn().mockResolvedValue(false),
        signIn: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
        ...options,
    };
    const store = createScoreboardStore([], { auth: { service, configured: true } });
    stores.push(store);
    return { store, service, unsubscribe, notify: value => notify(value) };
}
afterEach(async () => { for (const store of stores.splice(0)) await store.dispatch('auth/stop'); });

describe('auth lifecycle and permission', () => {
    it('distinguishes public, unapproved and approved users without retaining tokens', async () => {
        const { store, service, notify } = setup();
        await store.dispatch('auth/start');
        expect(store.state.auth.user).toBeNull();
        notify(session('friend'));
        await tick();
        expect(store.state.auth.user.name).toBe('friend');
        expect(store.getters.canEdit).toBe(false);
        service.isEditor.mockResolvedValue(true);
        service.getSession.mockResolvedValue(session('friend'));
        await store.dispatch('auth/refresh');
        expect(store.getters.canEdit).toBe(true);
        expect(JSON.stringify(store.state)).not.toContain('private');
        service.isEditor.mockRejectedValue(new Error('secret backend error'));
        const refreshing = store.dispatch('auth/refresh');
        expect(store.getters.canEdit).toBe(false);
        await refreshing;
        expect(store.getters.canEdit).toBe(false);
        expect(store.state.auth.error).toBe('Nie udało się sprawdzić uprawnień.');
    });
    it('invalidates an in-flight membership check synchronously on sign-out', async () => {
        const pending = deferred();
        const { store, notify } = setup({ isEditor: vi.fn(() => pending.promise) });
        await store.dispatch('auth/start');
        notify(session('friend'));
        await tick();
        await store.dispatch('auth/signOut');
        pending.resolve(true);
        await tick();
        expect(store.state.auth.user).toBeNull();
        expect(store.getters.canEdit).toBe(false);
        expect(store.state.auth.user).toBeNull();
    });
    it('ignores old startup sessions and membership results after a different auth event', async () => {
        const startup = deferred();
        const oldMembership = deferred();
        const { store, service, notify } = setup({ getSession: vi.fn(() => startup.promise), isEditor: vi.fn(() => oldMembership.promise) });
        const start = store.dispatch('auth/start');
        notify(session('first'));
        expect(service.isEditor).not.toHaveBeenCalled();
        await tick();
        service.isEditor.mockResolvedValue(false);
        notify(session('second'));
        startup.resolve(session('stale'));
        oldMembership.resolve(true);
        await start;
        await tick();
        expect(store.state.auth.user.id).toBe('second');
        expect(store.getters.canEdit).toBe(false);
    });
    it('subscribes once, refreshes on return and cleans up on stop', async () => {
        const { store, service, unsubscribe, notify } = setup();
        await store.dispatch('auth/start');
        await store.dispatch('auth/start');
        expect(service.subscribe).toHaveBeenCalledOnce();
        window.dispatchEvent(new Event('focus'));
        await tick();
        expect(service.getSession).toHaveBeenCalledTimes(2);
        await store.dispatch('auth/stop');
        window.dispatchEvent(new Event('focus'));
        notify(session('late'));
        await tick();
        expect(unsubscribe).toHaveBeenCalledOnce();
        expect(service.getSession).toHaveBeenCalledTimes(2);
        expect(store.getters.canEdit).toBe(false);
    });
    it('never uses fixture editing as permission in a configured store', async () => {
        const store = createScoreboardStore(createPreviewContests(), { editable: true, auth: { configured: true } });
        expect(store.state.preview).toBe(false);
        expect(store.getters.canEdit).toBe(false);
        await store.dispatch('contests/draft', { entryId: 'anything', voterId: 'anything', text: '10' });
        expect(store.state.contests.drafts).toEqual({});
    });
    it('keeps permission removed and offers sign-out retry after a failed request', async () => {
        const { store, service, notify } = setup({ getSession: vi.fn().mockResolvedValue(session('friend')), isEditor: vi.fn().mockResolvedValue(true) });
        await store.dispatch('auth/start');
        expect(store.getters.canEdit).toBe(true);
        const pending = deferred();
        service.signOut.mockImplementationOnce(() => pending.promise);
        const signingOut = store.dispatch('auth/signOut');
        expect(store.getters.canEdit).toBe(false);
        notify(session('friend'));
        await tick();
        expect(store.getters.canEdit).toBe(false);
        pending.resolve(Promise.reject(new Error('private error')));
        await signingOut;
        expect(store.state.auth.user.id).toBe('friend');
        expect(store.state.auth.error).toContain('Spróbuj ponownie');
        await store.dispatch('auth/signOut');
        expect(store.state.auth.user).toBeNull();
    });
    it('reports startup and OAuth errors without raw service details', async () => {
        const { store, service } = setup({ getSession: vi.fn().mockRejectedValue(new Error('private')), signIn: vi.fn().mockRejectedValue(new Error('private')) });
        await store.dispatch('auth/start');
        expect(store.state.auth.error).toBe('Nie udało się odczytać sesji.');
        await store.dispatch('auth/signIn');
        expect(service.signIn).toHaveBeenCalledWith('http://localhost:3000/');
        expect(store.state.auth.error).toBe('Nie udało się zalogować przez GitHub.');
        expect(store.state.auth.busy).toBe(false);
    });
});

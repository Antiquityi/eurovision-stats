import { authRedirectUrl } from '../services/auth.js';

export function createAuthModule({ service = null, configured = false, configError = '', basePath = '/', browser = globalThis.window } = {}) {
    let running = false;
    let generation = 0;
    let unsubscribe = null;
    let onReturn = null;
    let initialising = null;
    let signingOut = false;
    let lifecycle = 0;
    return {
        namespaced: true,
        state: () => ({ configured, available: Boolean(service), user: null, isEditor: false, busy: false, error: configError }),
        mutations: {
            session(state, session) {
                // Do not copy OAuth/access tokens into application state.
                state.user = session?.user ? { id: session.user.id, name: session.user.user_metadata?.user_name || 'GitHub' } : null;
                state.isEditor = false;
                state.busy = Boolean(session);
                state.error = '';
            },
            access(state, isEditor) { state.isEditor = isEditor; state.busy = false; },
            error(state, message) { state.isEditor = false; state.busy = false; state.error = message; },
            busy(state, value) { state.busy = value; state.error = ''; },
        },
        actions: {
            async accept({ commit }, session) {
                if (!running || (signingOut && session)) return;
                const request = ++generation;
                commit('session', session);
                if (!session) return;
                // Leave the SDK auth callback/lock before making another SDK call.
                await new Promise(resolve => setTimeout(resolve, 0));
                if (!running || request !== generation) return;
                try {
                    const editor = await service.isEditor(session.user.id);
                    if (running && request === generation) commit('access', editor);
                } catch {
                    if (running && request === generation) commit('error', 'Nie udało się sprawdzić uprawnień.');
                }
            },
            start({ dispatch, commit }) {
                if (!service || running) return initialising;
                running = true;
                ++lifecycle;
                const request = generation;
                unsubscribe = service.subscribe(session => { void dispatch('accept', session); });
                onReturn = () => {
                    if (browser.document.visibilityState === 'visible') void dispatch('refresh');
                };
                browser.addEventListener('focus', onReturn);
                browser.document.addEventListener('visibilitychange', onReturn);
                if (request === generation) commit('busy', true);
                initialising = service.getSession().then(session => {
                    if (running && request === generation) return dispatch('accept', session);
                }).catch(() => {
                    if (running && request === generation) commit('error', 'Nie udało się odczytać sesji.');
                });
                return initialising;
            },
            async refresh({ commit, dispatch }) {
                if (!running || !service || signingOut) return;
                const request = ++generation;
                commit('access', false);
                commit('busy', true);
                try {
                    const session = await service.getSession();
                    if (running && request === generation) await dispatch('accept', session);
                } catch {
                    if (running && request === generation) commit('error', 'Nie udało się odświeżyć sesji.');
                }
            },
            async signIn({ commit, rootState }) {
                if (!running || !service) return;
                const operation = lifecycle;
                commit('busy', true);
                try {
                    await service.signIn(authRedirectUrl(browser.location.href, basePath, rootState.contests.active?.year));
                    if (running && operation === lifecycle) commit('busy', false);
                } catch {
                    if (running && operation === lifecycle) commit('error', 'Nie udało się zalogować przez GitHub.');
                }
            },
            async signOut({ commit }) {
                if (!running || !service || signingOut) return;
                const operation = lifecycle;
                signingOut = true;
                ++generation;
                commit('access', false);
                commit('busy', true);
                try {
                    await service.signOut();
                    if (running && operation === lifecycle) commit('session', null);
                } catch {
                    if (running && operation === lifecycle) commit('error', 'Nie udało się wylogować. Spróbuj ponownie.');
                } finally {
                    if (operation === lifecycle) signingOut = false;
                }
            },
            stop({ commit }) {
                running = false;
                ++lifecycle;
                signingOut = false;
                ++generation;
                unsubscribe?.();
                unsubscribe = null;
                if (onReturn) {
                    browser.removeEventListener('focus', onReturn);
                    browser.document.removeEventListener('visibilitychange', onReturn);
                    onReturn = null;
                }
                commit('session', null);
            },
        },
    };
}

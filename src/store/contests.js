import { parseRating } from '../domain/ratings.js';

export const cellKey = (entryId, voterId) => `${entryId}:${voterId}`;

export function createContestsModule(copies, { service = null, realtime = null, selectedYear = null, browser = globalThis.window } = {}) {
    let running = false;
    let generation = 0;
    let lifecycle = 0;
    let dispose = null;
    let listeners = [];
    let refresh = null;
    let refreshAgain = false;
    const queues = new Map();
    const enqueued = new Map();
    const apply = (state, row) => {
        if (row.contest_id !== state.active?.id) return;
        const entry = state.active.entries.find(entry => entry.id === row.entry_id);
        if (entry && Object.hasOwn(entry.ratings, row.voter_id)) entry.ratings[row.voter_id] = row.value;
    };
    return {
        namespaced: true,
        state: () => ({ list: copies, active: copies.find(contest => String(contest.year) === String(selectedYear)) ?? copies[0] ?? null,
            drafts: {}, versions: {}, cancellations: {}, cells: {}, confirmed: {}, selectedId: null,
            loading: false, connected: false, stale: Boolean(service), error: '' }),
        getters: { entries: state => state.active?.entries ?? [] },
        mutations: {
            list(state, list) { state.list = list; },
            select(state, id) { state.selectedId = id; state.active = copies.find(contest => contest.id === id) ?? null; },
            draft(state, { key, text }) {
                state.drafts[key] = text;
                state.versions[key] = (state.versions[key] ?? 0) + 1;
                state.cells[key] = 'draft';
            },
            clearDraft(state, key) { delete state.drafts[key]; },
            cancel(state, key) {
                delete state.drafts[key];
                state.cancellations[key] = (state.cancellations[key] ?? 0) + 1;
                state.cells[key] = '';
            },
            cell(state, { key, status }) { state.cells[key] = status; },
            connection(state, connected) { state.connected = connected; state.stale = true; },
            loading(state, value) { state.loading = value; },
            error(state, message) { state.error = message; state.stale = true; },
            fresh(state) { state.error = ''; state.stale = !state.connected; },
            snapshot(state, contest) {
                state.active = contest;
                for (const row of contest.ratings) {
                    const key = cellKey(row.entry_id, row.voter_id);
                    if (!state.confirmed[key] || BigInt(row.revision) > BigInt(state.confirmed[key].revision)) state.confirmed[key] = row;
                }
                // Events may arrive while the snapshot is in flight, even before entries exist.
                Object.values(state.confirmed).forEach(row => apply(state, row));
            },
            confirmed(state, row) {
                const key = cellKey(row.entry_id, row.voter_id);
                if (state.confirmed[key] && BigInt(row.revision) <= BigInt(state.confirmed[key].revision)) return;
                state.confirmed[key] = row;
                apply(state, row);
            },
            rating(state, { entryId, voterId, value }) {
                const entry = state.active?.entries.find(row => row.id === entryId);
                if (entry && Object.hasOwn(entry.ratings, voterId)) entry.ratings[voterId] = value;
            },
        },
        actions: {
            start({ dispatch }) {
                if (!service || !realtime || running) return;
                running = true;
                ++lifecycle;
                const listen = (target, name, callback) => {
                    target.addEventListener(name, callback);
                    listeners.push(() => target.removeEventListener(name, callback));
                };
                listen(browser, 'offline', () => dispatch('offline'));
                listen(browser, 'online', () => dispatch('connect'));
                const onReturn = () => {
                    if (browser.document.visibilityState === 'visible') void dispatch('return');
                };
                listen(browser, 'focus', onReturn);
                listen(browser.document, 'visibilitychange', onReturn);
                return dispatch('connect');
            },
            offline({ commit }) { commit('connection', false); },
            return({ state, dispatch }) {
                if (state.connected) return dispatch('refresh');
                return dispatch('connect');
            },
            connect({ state, commit, dispatch }) {
                if (!running) return;
                dispose?.();
                dispose = null;
                const request = ++generation;
                refresh = null;
                refreshAgain = false;
                commit('connection', false);
                commit('loading', !state.active);
                if (browser?.navigator?.onLine === false) { commit('loading', false); return; }
                dispose = realtime.subscribe(state.selectedId, {
                    rating: row => { if (running && request === generation) commit('confirmed', row); },
                    contests: () => {
                        if (!running || request !== generation) return;
                        if (refresh) refreshAgain = true;
                        else void dispatch('refresh');
                    },
                    status: status => {
                        if (!running || request !== generation) return;
                        if (status === 'SUBSCRIBED') {
                            if (browser?.navigator?.onLine === false) return;
                            commit('connection', true);
                            void dispatch('refresh');
                        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
                            commit('connection', false);
                            commit('loading', false);
                        }
                    },
                });
            },
            refresh({ state, commit, dispatch }) {
                if (!running || !state.connected) return;
                if (refresh) return refresh;
                const request = generation;
                const current = () => running && request === generation;
                commit('loading', true);
                // Revoke UI permission immediately while rechecking membership.
                const membership = dispatch('auth/refresh', null, { root: true });
                refresh = (async () => {
                    try {
                        const list = await service.listContests();
                        if (!current()) return;
                        commit('list', list);
                        const id = list.find(contest => contest.id === state.selectedId)?.id
                            ?? list.find(contest => String(contest.year) === String(selectedYear))?.id ?? list[0]?.id ?? null;
                        if (id !== state.selectedId) {
                            await dispatch('select', id);
                            return;
                        }
                        if (id) {
                            const contest = await service.getContest(id);
                            if (!current()) return;
                            commit('snapshot', contest);
                        }
                        await membership;
                        if (current()) commit('fresh');
                    } catch {
                        if (current()) commit('error', 'Nie udało się odświeżyć wyników. Spróbuj ponownie.');
                    } finally {
                        if (current()) {
                            commit('loading', false); refresh = null;
                            if (refreshAgain) { refreshAgain = false; void dispatch('refresh'); }
                        }
                    }
                })();
                return refresh;
            },
            select({ commit, dispatch }, id) {
                commit('select', id);
                if (service) return dispatch('connect');
            },
            draft({ rootGetters, commit }, { entryId, voterId, text }) {
                if (rootGetters.canEdit) commit('draft', { key: cellKey(entryId, voterId), text });
            },
            cancel({ commit }, key) { commit('cancel', key); },
            save({ state, rootState, rootGetters, commit, dispatch }, { entryId, voterId, retry = false }) {
                const key = cellKey(entryId, voterId);
                if (!Object.hasOwn(state.drafts, key)) return;
                const version = state.versions[key];
                if (enqueued.get(key) === version && queues.has(key)) return queues.get(key);
                if (enqueued.get(key) === version && !retry) return queues.get(key);
                if (!rootGetters.canCommit) { commit('cell', { key, status: 'error' }); return; }
                const value = parseRating(state.drafts[key]);
                if (rootState.preview) {
                    commit('rating', { entryId, voterId, value });
                    commit('clearDraft', key);
                    return;
                }
                const cancellation = state.cancellations[key];
                const contestId = state.active?.id;
                const operation = lifecycle;
                const current = () => running && operation === lifecycle;
                const job = async () => {
                    if (state.cancellations[key] !== cancellation) return;
                    const matches = () => state.versions[key] === version && state.cancellations[key] === cancellation;
                    try {
                        if (!current() || !rootGetters.canCommit) throw new Error('Unavailable');
                        if (matches()) commit('cell', { key, status: 'saving' });
                        const row = await service.saveRating(entryId, voterId, value);
                        if (!current()) return;
                        if (row.contest_id !== contestId || row.entry_id !== entryId || row.voter_id !== voterId) throw new Error('Unexpected rating');
                        commit('confirmed', row);
                        if (matches()) {
                            commit('clearDraft', key);
                            commit('cell', { key, status: 'saved' });
                        }
                    } catch {
                        if (current() && matches()) commit('cell', { key, status: 'error' });
                        if (current()) void dispatch('auth/refresh', null, { root: true });
                    }
                };
                enqueued.set(key, version);
                const pending = (queues.get(key) ?? Promise.resolve()).then(job);
                queues.set(key, pending);
                void pending.finally(() => { if (queues.get(key) === pending) queues.delete(key); });
                return pending;
            },
            stop({ state, commit }) {
                running = false;
                ++lifecycle;
                ++generation;
                dispose?.(); dispose = null;
                listeners.forEach(remove => remove()); listeners = [];
                refresh = null;
                for (const key of Object.keys(state.drafts)) commit('cell', { key, status: 'error' });
                commit('connection', false);
            },
        },
    };
}

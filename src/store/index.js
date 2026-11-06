import { createStore } from 'vuex';
import { parseRating } from '../domain/ratings.js';

export const cellKey = (entryId, voterId) => `${entryId}:${voterId}`;

// Frontend-only state for TASK-002. No authentication or persistence adapter.
export function createScoreboardStore(contests = [], { editable = false } = {}) {
    const copies = structuredClone(contests);
    return createStore({
        state: { preview: copies.length > 0, editable },
        modules: {
            contests: {
                namespaced: true,
                state: () => ({ list: copies, active: copies[0] ?? null, drafts: {} }),
                getters: { entries: state => state.active?.entries ?? [] },
                mutations: {
                    select(state, id) { state.active = state.list.find(contest => contest.id === id) ?? null; },
                    draft(state, { key, text }) { state.drafts[key] = text; },
                    clearDraft(state, key) { delete state.drafts[key]; },
                    rating(state, { entryId, voterId, value }) {
                        const entry = state.active?.entries.find(row => row.id === entryId);
                        if (entry && Object.hasOwn(entry.ratings, voterId)) entry.ratings[voterId] = value;
                    },
                },
                actions: {
                    select({ commit }, id) { commit('select', id); },
                    draft({ rootState, commit }, { entryId, voterId, text }) {
                        if (rootState.editable) commit('draft', { key: cellKey(entryId, voterId), text });
                    },
                    cancel({ commit }, key) { commit('clearDraft', key); },
                    save({ state, rootState, commit }, { entryId, voterId }) {
                        if (!rootState.editable) return;
                        const key = cellKey(entryId, voterId);
                        if (!Object.hasOwn(state.drafts, key)) return;
                        const value = parseRating(state.drafts[key]);
                        commit('rating', { entryId, voterId, value });
                        commit('clearDraft', key);
                    },
                },
            },
        },
    });
}

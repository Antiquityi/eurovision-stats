import { createStore } from 'vuex';
import { createAuthModule } from './auth.js';
import { createContestsModule } from './contests.js';

export { cellKey } from './contests.js';

export function createScoreboardStore(contests = [], { editable = false, auth = {}, selectedYear = null, selectedContestId = null, ...live } = {}) {
    const copies = structuredClone(contests);
    return createStore({
        state: { preview: copies.length > 0 && !auth.configured, editable: editable && !auth.configured },
        getters: {
            canEdit: state => state.preview ? state.editable : state.auth.isEditor,
            canCommit: (state, getters) => getters.canEdit && (state.preview
                || (!state.auth.busy && state.contests.connected && !state.contests.stale)),
        },
        modules: {
            auth: createAuthModule(auth),
            contests: createContestsModule(copies, { ...live, selectedYear, selectedContestId }),
        },
    });
}

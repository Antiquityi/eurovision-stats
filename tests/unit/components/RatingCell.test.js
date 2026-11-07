import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RatingCell from '../../../src/components/RatingCell.vue';
import { createScoreboardStore } from '../../../src/store/index.js';

let wrapper;
afterEach(() => wrapper?.unmount());

it('shows pending and failed drafts, offers retry and keeps totals confirmed', async () => {
    let reject;
    const pending = new Promise((_resolve, fail) => { reject = fail; });
    let callbacks;
    const row = { contest_id: 'c', entry_id: 'e', voter_id: 'v', value: 2, revision: 1 };
    const contest = { id: 'c', year: 2026, title: 'Eurowizja 2026', voters: [{ id: 'v', name: 'Jan' }],
        entries: [{ id: 'e', ratings: { v: null } }], ratings: [row] };
    const service = { listContests: async () => [contest], getContest: async () => structuredClone(contest), saveRating: vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce({ ...row, value: 7.5, revision: 2 }) };
    const store = createScoreboardStore([], { auth: { configured: true }, service, realtime: { subscribe: (_id, value) => { callbacks = value; return () => {}; } } });
    await store.dispatch('contests/start'); callbacks.status('SUBSCRIBED'); await flushPromises();
    callbacks.status('SUBSCRIBED'); await flushPromises(); store.commit('auth/access', true);
    wrapper = mount(RatingCell, { props: { entry: { id: 'e', countryName: 'Polska' }, voter: contest.voters[0], value: 2 }, global: { plugins: [store] } });
    await wrapper.get('input').setValue('7,5');
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    expect(wrapper.text()).toContain('Zapisywanie');
    expect(store.getters['contests/entries'][0].ratings.v).toBe(2);
    reject(new Error('network')); await flushPromises();
    expect(wrapper.text()).toContain('Nie zapisano');
    expect(wrapper.get('input').element.value).toBe('7,5');
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(wrapper.find('.cell-status').exists()).toBe(false);
    expect(store.getters['contests/entries'][0].ratings.v).toBe(7.5);
    await store.dispatch('contests/stop');
});

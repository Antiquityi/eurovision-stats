import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from '../../../src/App.vue';
import PodiumSummary from '../../../src/components/PodiumSummary.vue';
import { createScoreboardStore } from '../../../src/store/index.js';

const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
function render(editable = true) {
    const contest = { id: 'year', year: 2025, title: 'Eurowizja 2025', voters: [{ id: 'v', name: 'Anna' }],
        entries: ['Polska', 'Francja', 'Włochy', 'Finlandia'].map((countryName, i) => ({
            id: 'e' + i, order: i + 1, countryCode: ['PL', 'FR', 'IT', 'FI'][i], countryName, ratings: { v: i ? 6 : 8 },
        })) };
    const store = createScoreboardStore([contest], { editable });
    const wrapper = mount(App, { global: { plugins: [store] } }); wrappers.push(wrapper);
    const podium = wrapper.getComponent(PodiumSummary);
    podium.vm.$refs.tieDialog.showModal = vi.fn();
    podium.vm.$refs.tieDialog.close = vi.fn();
    return { wrapper, podium, store };
}

describe('editor tie resolution', () => {
    it('moves only tied countries, saves on confirmation, updates table medals, and resets shared places', async () => {
        const { wrapper, podium, store } = render();
        await wrapper.get('[aria-label="Rozstrzygnij remis: Anna"]').trigger('click');
        await podium.get('[aria-label="Wyżej: Finlandia"]').trigger('click');
        expect(store.state.contests.active.tieBreaks).toBeUndefined();
        await podium.vm.save(); await flushPromises();
        const ranks = podium.vm.groups.find(group => group.id === 'v').podium;
        expect(ranks.map(entry => [entry.countryName, entry.rank])).toEqual([['Polska', 1], ['Francja', 2], ['Finlandia', 3]]);
        const italyRow = wrapper.findAll('tbody tr').find(row => row.text().includes('Włochy'));
        expect(italyRow.find('.rating-cell .medal-marker').exists()).toBe(false);
        expect(podium.vm.groups[0].podium).toHaveLength(4); // Total choices are independent.
        await wrapper.get('[aria-label="Rozstrzygnij remis: Anna"]').trigger('click');
        await podium.vm.save(true); await flushPromises();
        expect(podium.vm.groups.find(group => group.id === 'v').podium.map(entry => entry.rank)).toEqual([1, 2, 2, 2]);
    });
    it('has no controls for viewers and keeps cancellation free of writes', async () => {
        const viewer = render(false);
        expect(viewer.wrapper.find('.tie-trigger').exists()).toBe(false);
        const { wrapper, podium, store } = render();
        await wrapper.get('[aria-label="Rozstrzygnij remis: Anna"]').trigger('click');
        await podium.get('[aria-label="Wyżej: Finlandia"]').trigger('click');
        podium.vm.close();
        expect(store.state.contests.active.tieBreaks).toBeUndefined();
    });
    it('keeps failed choices for retry and blocks changed tie groups', async () => {
        const { wrapper, podium, store } = render();
        await wrapper.get('[aria-label="Rozstrzygnij remis: Anna"]').trigger('click');
        vi.spyOn(store, 'dispatch').mockRejectedValueOnce(new Error('Save failed'));
        await podium.vm.save();
        expect(podium.vm.error).toBe('Save failed');
        expect(podium.vm.editing).not.toBeNull();
        store.commit('contests/rating', { entryId: 'e3', voterId: 'v', value: 7 });
        await flushPromises();
        expect(podium.vm.changed).toBe(true);
        expect(podium.get('[role="alert"]').text()).toContain('Save failed');
        await podium.vm.save();
        expect(store.state.contests.active.tieBreaks).toBeUndefined();
    });
});

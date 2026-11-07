import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ScoreboardTable from '../../../src/components/ScoreboardTable.vue';
import { createScoreboardStore } from '../../../src/store/index.js';
import { createPreviewContests } from '../../fixtures/scoreboard.js';

const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
function render(editable = true) {
    const store = createScoreboardStore(createPreviewContests(), { editable });
    const wrapper = mount(ScoreboardTable, { global: { plugins: [store] } });
    wrappers.push(wrapper);
    return { wrapper, store };
}
async function editName(wrapper, name) {
    await wrapper.get(`[aria-label="Opcje osoby: ${name}"]`).trigger('click');
    await wrapper.get(`[aria-label="Zmień imię: ${name}"]`).trigger('click');
}

describe('voter columns', () => {
    it('renames on Enter/blur once, preserves scores and supports Escape', async () => {
        const { wrapper, store } = render();
        const dispatch = vi.spyOn(store, 'dispatch');
        const scores = store.state.contests.active.entries.map(entry => entry.ratings.pawel);
        await editName(wrapper, 'Paweł');
        const input = wrapper.get('input[aria-label="Imię osoby: Paweł"]');
        await input.setValue('  Piotr  ');
        await input.trigger('keydown', { key: 'Enter' });
        await input.trigger('blur');
        await flushPromises();
        expect(store.state.contests.active.voters[0].name).toBe('Piotr');
        expect(store.state.contests.active.entries.map(entry => entry.ratings.pawel)).toEqual(scores);
        expect(dispatch.mock.calls.filter(([action]) => action === 'contests/manageVoter')).toHaveLength(1);
        await editName(wrapper, 'Piotr');
        const next = wrapper.get('input[aria-label="Imię osoby: Piotr"]');
        await next.setValue('Cancelled');
        await next.trigger('keydown', { key: 'Escape' });
        await next.trigger('blur');
        expect(store.state.contests.active.voters[0].name).toBe('Piotr');
    });
    it('keeps a failed rename for retry and rejects blank names', async () => {
        const { wrapper, store } = render();
        const dispatch = vi.spyOn(store, 'dispatch');
        await editName(wrapper, 'Paweł');
        const input = wrapper.get('input[aria-label="Imię osoby: Paweł"]');
        await input.setValue('  ');
        await input.trigger('blur');
        expect(wrapper.get('[role="alert"]').text()).toBe('Wpisz imię.');
        dispatch.mockRejectedValueOnce(new Error('Nie udało się zapisać zmiany osoby. Spróbuj ponownie.'));
        await input.setValue('Piotr');
        await input.trigger('keydown', { key: 'Enter' });
        await flushPromises();
        expect(input.element.value).toBe('Piotr');
        expect(store.state.contests.active.voters[0].name).toBe('Paweł');
        await input.trigger('keydown', { key: 'Enter' });
        await flushPromises();
        expect(store.state.contests.active.voters[0].name).toBe('Piotr');
    });
    it('offers no person controls to viewers', () => {
        const { wrapper } = render(false);
        expect(wrapper.find('[aria-label="Dodaj osobę"]').exists()).toBe(false);
        expect(wrapper.find('.voter-menu-trigger').exists()).toBe(false);
        expect(wrapper.get('[data-sort="pawel"]').text()).toContain('Paweł');
    });
});

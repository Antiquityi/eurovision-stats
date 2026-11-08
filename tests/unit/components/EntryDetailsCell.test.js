import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import EntryDetailsCell from '../../../src/components/EntryDetailsCell.vue';
import { createScoreboardStore } from '../../../src/store/index.js';
import { createPreviewContests } from '../../fixtures/scoreboard.js';

const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
function render(editable = true) {
    const store = createScoreboardStore(createPreviewContests(), { editable });
    const contest = store.state.contests.active;
    const entry = contest.entries[0];
    const wrapper = mount(EntryDetailsCell, { props: { entry, contestId: contest.id }, global: { plugins: [store] } });
    wrappers.push(wrapper);
    return { wrapper, store, entry };
}

it('saves one combined field, cancels a draft and allows clearing without changing ratings', async () => {
    const { wrapper, entry } = render();
    const ratings = { ...entry.ratings };
    const input = wrapper.get('input');
    await input.setValue('  Artysta — Utwór  ');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(entry.artistSong).toBe('Artysta — Utwór');
    await input.setValue('Discard');
    await input.trigger('keydown', { key: 'Escape' });
    await input.trigger('blur');
    expect(entry.artistSong).toBe('Artysta — Utwór');
    expect(input.element.value).toBe('Artysta — Utwór');
    await input.setValue('');
    await input.trigger('blur');
    await flushPromises();
    expect(entry.artistSong).toBe('');
    expect(entry.ratings).toEqual(ratings);
});

it('retains an unsuccessful draft for retry', async () => {
    const { wrapper, store } = render();
    const dispatch = vi.spyOn(store, 'dispatch').mockRejectedValueOnce(new Error('Nie zapisano'));
    await wrapper.get('input').setValue('Artysta — Utwór');
    await wrapper.get('input').trigger('blur');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Nie zapisano');
    expect(wrapper.get('input').element.value).toBe('Artysta — Utwór');
    dispatch.mockRestore();
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
});

it('displays saved text to viewers without an editing control', async () => {
    const { wrapper, entry } = render(false);
    entry.artistSong = 'Artysta — Utwór';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.text()).toBe('Artysta — Utwór');
});

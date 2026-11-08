import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../../../src/App.vue';
import ScoreboardTable from '../../../src/components/ScoreboardTable.vue';
import { createScoreboardStore } from '../../../src/store/index.js';
import { createPreviewContests } from '../../fixtures/scoreboard.js';

const wrappers = [];
function render(component = App, editable = true, contests = createPreviewContests()) {
    const store = createScoreboardStore(contests, { editable });
    const wrapper = mount(component, { attachTo: document.body, global: { plugins: [store] } });
    wrappers.push(wrapper);
    return { wrapper, store };
}
const inputFor = (wrapper, name = 'Dania, Paweł') => wrapper.get(`input[aria-label="${name}"]`);
const order = wrapper => wrapper.findAll('tbody .order').map(cell => cell.text());

afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); });

describe('spreadsheet workspace', () => {
    it('averages each person’s saved scores per contest, including zero and excluding blanks', async () => {
        const contests = createPreviewContests();
        for (const entry of contests[0].entries) {
            for (const voter of contests[0].voters) entry.ratings[voter.id] = null;
        }
        [0, 0.5, 9].forEach((value, index) => { contests[0].entries[index].ratings.pawel = value; });
        contests[0].entries[0].ratings.albert = 10;
        const { wrapper } = render(App, true, contests);
        const averages = () => wrapper.findAll('tfoot .average-cell').map(cell => cell.text());
        const overall = () => wrapper.get('.contest-average strong').text();
        expect(wrapper.get('tfoot th').text()).toBe('Średnia ocena');
        expect(averages()).toEqual(['3,17', '10', '—', '—']);
        expect(overall()).toBe('4,88');
        await inputFor(wrapper).setValue('6');
        expect(averages()[0]).toBe('3,17');
        expect(overall()).toBe('4,88');
        await inputFor(wrapper).trigger('keydown', { key: 'Enter' });
        expect(averages()[0]).toBe('5,17');
        expect(overall()).toBe('6,38');
        await wrapper.get('button[data-sort="pawel"]').trigger('click');
        expect(averages()[0]).toBe('5,17');
        expect(overall()).toBe('6,38');
        await wrapper.get('nav button:last-child').trigger('click');
        expect(averages()[0]).not.toBe('5,17');
        expect(overall()).not.toBe('6,38');
        await wrapper.get('nav button:first-child').trigger('click');
        expect(averages()[0]).toBe('5,17');
        expect(overall()).toBe('6,38');
        await inputFor(wrapper).setValue('');
        await inputFor(wrapper).trigger('blur');
        expect(averages()[0]).toBe('4,75');
        expect(overall()).toBe('6,5');
    });
    it('shows a blank overall average without scores and includes a lone zero', async () => {
        const contests = createPreviewContests();
        for (const entry of contests[0].entries) {
            for (const voter of contests[0].voters) entry.ratings[voter.id] = null;
        }
        const { wrapper } = render(ScoreboardTable, true, contests);
        expect(wrapper.get('.contest-average strong').text()).toBe('—');
        await inputFor(wrapper).setValue('0');
        await inputFor(wrapper).trigger('blur');
        expect(wrapper.get('.contest-average strong').text()).toBe('0');
    });
    it('starts with year tabs and a table, without marketing sections', () => {
        const { wrapper } = render();
        expect(wrapper.get('nav[aria-label="Wybierz rok"]').text()).toContain('2025');
        expect(wrapper.find('table').exists()).toBe(true);
        expect(wrapper.findAll('tbody tr')).toHaveLength(26);
        expect(wrapper.find('details').exists()).toBe(false);
        expect(wrapper.get('section[aria-label="Podium"]').isVisible()).toBe(true);
        expect(wrapper.find('footer').exists()).toBe(false);
        expect(wrapper.text()).not.toMatch(/WIECZÓR Z PRZYJACIÓŁMI|Cztery opinie|Każdy głos się liczy|Nasze głosy/);
    });
    it('sorts voter and total headers in both directions with missing scores last, and restores order', async () => {
        const { wrapper } = render(ScoreboardTable);
        await wrapper.get('button[data-sort="pawel"]').trigger('click');
        expect(order(wrapper).slice(0, 3)).toEqual(['02', '03', '01']);
        expect(order(wrapper).at(-1)).toBe('08');
        expect(wrapper.get('th[aria-sort="descending"]').text()).toContain('Paweł');
        await wrapper.get('button[data-sort="pawel"]').trigger('click');
        expect(order(wrapper).at(-1)).toBe('08');
        await wrapper.get('button[data-sort="total"]').trigger('click');
        expect(order(wrapper).slice(0, 2)).toEqual(['02', '03']);
        await wrapper.get('button[data-sort="order"]').trigger('click');
        expect(order(wrapper)).toEqual(Array.from({ length: 26 }, (_, index) => String(index + 1).padStart(2, '0')));
    });
    it('commits decimal commas with Enter, clears with blur and cancels with Escape', async () => {
        const { wrapper, store } = render();
        const input = inputFor(wrapper);
        await input.setValue('7,5');
        await input.trigger('keydown', { key: 'Enter' });
        expect(store.getters['contests/entries'][0].ratings.pawel).toBe(7.5);
        await input.setValue('9');
        await input.trigger('keydown', { key: 'Escape' });
        expect(input.element.value).toBe('7,5');
        await input.trigger('blur');
        expect(store.getters['contests/entries'][0].ratings.pawel).toBe(7.5);
        await input.setValue('');
        await input.trigger('blur');
        expect(store.getters['contests/entries'][0].ratings.pawel).toBeNull();
    });
    it('blocks invalid input silently and clamps scores above ten', async () => {
        const { wrapper, store } = render();
        const before = store.getters['contests/entries'][0].ratings.pawel;
        await inputFor(wrapper).setValue('7,2');
        await inputFor(wrapper).trigger('keydown', { key: 'Enter' });
        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
        expect(store.getters['contests/entries'][0].ratings.pawel).toBe(before);
        expect(inputFor(wrapper).element.value).toBe(String(before));
        await inputFor(wrapper).setValue('11');
        expect(inputFor(wrapper).element.value).toBe('10');
        await inputFor(wrapper).trigger('blur');
        expect(store.getters['contests/entries'][0].ratings.pawel).toBe(10);
        await inputFor(wrapper).setValue('0,');
        await inputFor(wrapper).setValue('0,5');
        await inputFor(wrapper).trigger('blur');
        expect(store.getters['contests/entries'][0].ratings.pawel).toBe(0.5);
        await inputFor(wrapper).setValue('0');
        await inputFor(wrapper).trigger('blur');
        expect(store.getters['contests/entries'][0].ratings.pawel).toBe(0);
    });
    it('does not commit unchanged values twice on Enter then blur', async () => {
        const { wrapper, store } = render();
        const changes = [];
        const unsubscribe = store.subscribe(mutation => { if (mutation.type === 'contests/rating') changes.push(mutation); });
        await inputFor(wrapper).setValue('7,5');
        await inputFor(wrapper).trigger('keydown', { key: 'Enter' });
        await inputFor(wrapper).trigger('blur');
        expect(changes).toHaveLength(1);
        unsubscribe();
    });
    it('shows blank and provisional totals correctly, with distinct fixture podium places', () => {
        const { wrapper } = render();
        const rows = wrapper.findAll('tbody tr');
        expect(rows[7].get('.total strong').text()).toBe('—');
        expect(wrapper.find('.vote-count').exists()).toBe(false);
        expect(rows[4].get('.total').attributes('title')).toBe('Suma niepełna');
        expect(rows[1].get('.total .medal-marker').classes()).toContain('medal-1');
        expect(rows[2].get('.total .medal-marker').classes()).toContain('medal-2');
        expect(rows[0].get('.total .medal-marker').classes()).toContain('medal-3');
    });
    it('uses score shading independently of rank badges and leaves blanks neutral', () => {
        const { wrapper } = render();
        const high = inputFor(wrapper, 'Dania, Paweł').element.closest('td');
        expect(high.classList.contains('score-high')).toBe(true);
        expect(high.querySelector('.medal-3')).not.toBeNull();
        const low = inputFor(wrapper, 'Japonia, Paweł').element.closest('td');
        expect(low.classList.contains('score-low')).toBe(true);
        expect(low.querySelector('.medal-marker')).toBeNull();
        expect(inputFor(wrapper, 'Niemcy, Paweł').element.closest('td').classList.contains('score-empty')).toBe(true);
    });
    it('switches fixture years without mixing edits or drafts', async () => {
        const { wrapper, store } = render();
        await inputFor(wrapper).setValue('9');
        await wrapper.get('nav button:last-child').trigger('click');
        expect(store.state.contests.active.year).toBe(2024);
        expect(inputFor(wrapper).element.value).not.toBe('9');
        await wrapper.get('nav button:first-child').trigger('click');
        expect(inputFor(wrapper).element.value).toBe('9');
    });
    it('keeps viewers read-only and returns a blank workspace without data', () => {
        const { wrapper } = render(ScoreboardTable, false);
        expect(wrapper.find('input').exists()).toBe(false);
        const store = createScoreboardStore();
        expect(store.state.contests.active).toBeNull();
        expect(store.getters['contests/entries']).toEqual([]);
    });
    it('supports vertical keyboard movement in the visible sorted order', async () => {
        const { wrapper } = render();
        const first = inputFor(wrapper);
        first.element.focus();
        await first.trigger('keydown', { key: 'ArrowDown' });
        expect(document.activeElement.getAttribute('aria-label')).toBe('Szwecja, Paweł');
        await wrapper.get('input[aria-label="Szwecja, Paweł"]').trigger('keydown', { key: 'ArrowUp' });
        expect(document.activeElement).toBe(first.element);
    });
});

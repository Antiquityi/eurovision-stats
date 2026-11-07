import { test, expect } from '@playwright/test';

// Controlled service responses exercise the real App/store/cell in a browser.
// These checks do not establish hosted Supabase/RLS or cross-browser convergence.
const bootstrap = `
import { createApp } from '/node_modules/.vite/deps/vue.js';
import App from '/src/App.vue';
import { createScoreboardStore } from '/src/store/index.js';
import '/src/assets/tailwind.css';
const summary = { id: 'contest', year: 2099, title: 'Eurowizja 2099' };
const row = (value, revision) => ({ contest_id: 'contest', entry_id: 'entry', voter_id: 'voter', value, revision });
const control = window.voting = { editor: !location.search.includes('viewer'), fail: false, writes: [], current: row(2, 1) };
const service = {
    async listContests() { return [summary]; },
    async getContest() { return { ...summary, voters: [{ id: 'voter', name: 'Anna' }], entries: [{ id: 'entry', countryCode: 'PL', countryName: 'Polska', order: 1, ratings: { voter: null } }], ratings: [{ ...control.current }] }; },
    async saveRating(entryId, voterId, value) {
        control.writes.push({ entryId, voterId, value });
        await new Promise(resolve => setTimeout(resolve, 150));
        if (control.fail) { control.fail = false; throw new Error('network'); }
        control.current = row(value, control.current.revision + 1);
        return { ...control.current };
    }
};
const auth = { configured: true, service: {
    async getSession() { return { user: { id: 'friend' } }; },
    async isEditor() { return control.editor; },
    subscribe() { return () => {}; }
} };
const realtime = { subscribe(id, callbacks) {
    control.callbacks = callbacks;
    queueMicrotask(() => callbacks.status('SUBSCRIBED'));
    return () => {};
} };
control.store = createScoreboardStore([], { auth, service, realtime });
createApp(App).use(control.store).mount('#app');
`;

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true, configurable: true }));
    await page.route(/\/src\/main\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: bootstrap }));
});

test('confirmed totals, Enter/blur deduplication, cancel, failure and retry', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Polska, Anna', exact: true });
    await expect(input).toHaveValue('2');
    await input.fill('7,5'); await input.press('Enter'); await page.locator('[data-sort="total"]').click();
    await expect(page.getByText('Zapisywanie…', { exact: true })).toBeVisible();
    await expect(page.locator('.total strong')).toHaveText('2');
    await expect(page.locator('.total strong')).toHaveText('7,5');
    expect(await page.evaluate(() => window.voting.writes.length)).toBe(1);
    await input.fill('9'); await input.press('Escape'); await page.locator('[data-sort="total"]').click();
    await expect(input).toHaveValue('7,5');
    expect(await page.evaluate(() => window.voting.writes.length)).toBe(1);
    await page.evaluate(() => { window.voting.fail = true; });
    await input.fill('0'); await input.press('Enter');
    const retry = page.getByRole('button', { name: 'Ponów zapis: Polska, Anna' });
    await expect(retry).toBeVisible();
    await expect(input).toHaveValue('0');
    await expect(page.locator('.total strong')).toHaveText('7,5');
    await retry.click();
    await expect(page.locator('.total strong')).toHaveText('0');
    expect(errors).toEqual([]);
});

test('offline drafts survive reconnect and lost approval makes cells read-only', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Polska, Anna', exact: true });
    await expect(input).toHaveValue('2');
    await input.fill('8');
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await input.press('Enter');
    await expect(page.getByText('Brak połączenia.', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => window.voting.writes.length)).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(input).toHaveValue('8');
    await page.getByRole('button', { name: 'Ponów zapis: Polska, Anna' }).click();
    await expect(page.locator('.total strong')).toHaveText('8');
    await page.evaluate(async () => { window.voting.editor = false; await window.voting.store.dispatch('contests/refresh'); });
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.locator('.total strong')).toHaveText('8');
});

test('public viewers can read and cannot edit', async ({ page }) => {
    await page.goto('/?viewer');
    await expect(page.locator('.total strong')).toHaveText('2');
    await expect(page.getByRole('textbox')).toHaveCount(0);
});

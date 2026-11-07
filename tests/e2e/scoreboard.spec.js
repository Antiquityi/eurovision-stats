import { test, expect } from '@playwright/test';

// Keep fixture checks independent of ignored local Supabase configuration.
test.beforeEach(async ({ page }) => {
    await page.route(/\/src\/services\/supabase\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: "export const backend = { client: null, configured: false, error: '' };" }));
});

test('named contests in the same year have distinct tabs and survive reload and browser navigation', async ({ page }) => {
    await page.route(/\/src\/main\.js(?:\?.*)?$/, route => route.fulfill({
        contentType: 'application/javascript',
        body: `
import { createApp } from '/node_modules/.vite/deps/vue.js';
import App from '/src/App.vue';
import { createScoreboardStore } from '/src/store/index.js';
import '/src/assets/tailwind.css';
const mainId = '11111111-1111-1111-1111-111111111111';
const asiaId = '22222222-2222-2222-2222-222222222222';
const contests = [
    { id: mainId, year: 2026, title: 'Eurowizja 2026', voters: [{ id: 'main-v', name: 'Paweł' }],
      entries: [{ id: 'main-e', order: 1, countryCode: 'PL', countryName: 'Polska', ratings: { 'main-v': 9 } }] },
    { id: asiaId, year: 2026, title: '2026 ASIA', voters: [{ id: 'asia-v', name: 'Paweł' }],
      entries: [{ id: 'asia-e', order: 1, countryCode: 'VN', countryName: 'Wietnam', ratings: { 'asia-v': null } }] }
];
const params = new URL(location.href).searchParams;
const store = createScoreboardStore(contests, { editable: true, selectedYear: params.get('year'), selectedContestId: params.get('contest') });
createApp(App).use(store).mount('#app');
`,
    }));
    await page.goto('/?year=2026');
    await expect(page.getByRole('textbox', { name: 'Polska, Paweł', exact: true })).toHaveValue('9');
    await page.getByRole('button', { name: '2026 ASIA', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Wietnam, Paweł', exact: true })).toHaveValue('');
    await expect(page).toHaveURL(/contest=22222222-2222-2222-2222-222222222222/);
    await page.reload();
    await expect(page.getByRole('button', { name: '2026 ASIA', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('textbox', { name: 'Wietnam, Paweł', exact: true })).toHaveValue('');
    await page.goBack();
    await expect(page.getByRole('button', { name: '2026', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('textbox', { name: 'Polska, Paweł', exact: true })).toHaveValue('9');
    await page.goForward();
    await expect(page.getByRole('button', { name: '2026 ASIA', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('editors confirm adding/deleting people and rename inline without changing scores', async ({ page }) => {
    await page.goto('/');
    const original = page.getByRole('textbox', { name: 'Dania, Paweł', exact: true });
    await expect(original).toHaveValue('8');
    await page.getByRole('button', { name: 'Opcje osoby: Paweł', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Zmień imię: Paweł', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'Imię osoby: Paweł', exact: true });
    await name.fill('Piotr'); await name.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Dania, Piotr', exact: true })).toHaveValue('8');
    await expect(page.locator('.podium-group h2').filter({ hasText: 'Piotr' })).toBeVisible();
    await page.getByRole('button', { name: 'Dodaj osobę', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Dodać nową osobę do tabeli 2025?');
    await page.screenshot({ path: 'test-results/person-add-dialog.png', animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.locator('thead th')).toHaveCount(7);
    await page.getByRole('button', { name: 'Dodaj osobę', exact: true }).click();
    await dialog.getByLabel('Imię', { exact: true }).fill('Ewa');
    await dialog.getByRole('button', { name: 'Dodaj osobę', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Dania, Ewa', exact: true })).toHaveValue('');
    await expect(page.locator('thead th')).toHaveCount(8);
    await page.getByRole('textbox', { name: 'Dania, Ewa', exact: true }).fill('10');
    await page.getByRole('textbox', { name: 'Dania, Ewa', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Opcje osoby: Ewa', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Usuń osobę: Ewa', exact: true }).click();
    await expect(dialog).toContainText('wszystkie oceny');
    await page.screenshot({ path: 'test-results/person-delete-dialog.png', animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Dania, Ewa', exact: true })).toHaveValue('10');
    await page.getByRole('button', { name: 'Opcje osoby: Ewa', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Usuń osobę: Ewa', exact: true }).click();
    await dialog.getByRole('button', { name: 'Usuń osobę', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Dania, Ewa', exact: true })).toHaveCount(0);
    await expect(page.locator('thead th')).toHaveCount(7);
    await expect(page.getByRole('textbox', { name: 'Dania, Piotr', exact: true })).toHaveValue('8');
});

test('person menu stays above the grid and supports keyboard, outside click and mobile', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Opcje osoby: Paweł', exact: true });
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Zmień imię: Paweł' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Usuń osobę: Paweł' })).toBeFocused();
    await page.screenshot({ path: 'test-results/person-menu-desktop.png', animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator('h1').click();
    await expect(menu).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    await expect(menu).toBeInViewport();
    await page.screenshot({ path: 'test-results/person-menu-mobile.png', animations: 'disabled' });
    await page.getByRole('menuitem', { name: 'Zmień imię: Paweł' }).click();
    await page.getByRole('textbox', { name: 'Imię osoby: Paweł' }).fill('Jan');
    await page.getByRole('textbox', { name: 'Imię osoby: Paweł' }).press('Escape');
    await page.getByRole('button', { name: 'Dodaj osobę', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await page.screenshot({ path: 'test-results/person-add-mobile.png', animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('spreadsheet editing, invalid input, navigation, sorting and local years', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByText('Dane testowe')).toBeVisible();
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(26);
    await expect(page.getByRole('region', { name: 'Podium' })).toBeInViewport();
    const input = page.getByRole('textbox', { name: 'Dania, Paweł', exact: true });
    await input.fill('7,5'); await input.press('Enter');
    await expect(input).toHaveValue('7,5');
    await expect(page.locator('tbody tr').first().locator('.total strong')).toHaveText('31,5');
    await input.fill('7,2'); await input.press('Enter');
    await expect(input).toHaveValue('7,5');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await input.fill('11'); await expect(input).toHaveValue('10');
    await input.fill(''); await input.pressSequentially('0,5'); await input.press('Enter');
    await expect(input).toHaveValue('0,5');
    await input.fill('0'); await input.press('Enter'); await expect(input).toHaveValue('0');
    await input.fill('1,'); await input.pressSequentially('4'); await expect(input).toHaveValue('1,');
    await input.pressSequentially('5'); await input.press('Enter'); await expect(input).toHaveValue('1,5');
    await input.fill('7,5'); await input.press('Enter');
    await input.press('Escape'); await expect(input).toHaveValue('7,5');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await input.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Dania, Albert', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(input).toBeFocused();
    await input.press('ArrowDown');
    await expect(page.getByRole('textbox', { name: 'Szwecja, Paweł', exact: true })).toBeFocused();
    await page.locator('[data-sort="total"]').click();
    await expect(page.locator('tbody tr').first().locator('.country')).toContainText('Szwecja');
    await page.locator('[data-sort="order"]').click();
    await page.getByRole('button', { name: '2024', exact: true }).click();
    await expect(input).toHaveValue('7');
    await page.getByRole('button', { name: '2025', exact: true }).click();
    await expect(input).toHaveValue('7,5');
    await expect(page.getByRole('region', { name: 'Podium' })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/task-002-desktop.png', fullPage: true });
});

test('mobile table scrolls horizontally while country and header context stay visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const scroll = page.getByRole('region', { name: 'Tabela ocen' }).locator('.table-scroll');
    const country = page.locator('tbody .country').first();
    const before = await country.boundingBox();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await scroll.evaluate(element => { element.scrollLeft = 200; });
    const after = await country.boundingBox();
    expect(Math.abs(before.x - after.x)).toBeLessThan(1);
    await expect(country).toBeVisible();
    await page.screenshot({ path: 'test-results/task-002-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 320 });
    const header = page.locator('thead .country');
    const top = (await header.boundingBox()).y;
    await scroll.evaluate(element => { element.scrollTop = 120; });
    expect(Math.abs((await header.boundingBox()).y - top)).toBeLessThan(1);
});

import { test, expect } from '@playwright/test';

const bootstrap = `
import { createApp } from '/node_modules/.vite/deps/vue.js';
import App from '/src/App.vue';
import { createScoreboardStore } from '/src/store/index.js';
import '/src/assets/tailwind.css';
const contest = { id: 'tie-year', year: 2025, title: 'Eurowizja 2025', voters: [{ id: 'anna', name: 'Anna' }],
    entries: ['Polska', 'Francja', 'Włochy', 'Finlandia'].map((countryName, i) => ({
        id: 'entry-' + i, order: i + 1, countryCode: ['PL','FR','IT','FI'][i], countryName,
        ratings: { anna: i ? 6.5 : 8 }
    })) };
window.tieStore = createScoreboardStore([contest], { editable: !location.search.includes('viewer') });
createApp(App).use(window.tieStore).mount('#app');
`;

test.beforeEach(async ({ page }) => {
    await page.route(/\/src\/main\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: bootstrap }));
});

test('editor chooses podium places and table medals agree; scores and total podium stay unchanged', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', { name: 'Rozstrzygnij remis: Anna', exact: true }).click();
    await page.getByRole('button', { name: 'Wyżej: Finlandia', exact: true }).click();
    await page.getByRole('button', { name: 'Wyżej: Finlandia', exact: true }).click();
    await expect(page.locator('.tie-order .tie-country')).toHaveText(['Finlandia', 'Francja', 'Włochy']);
    await page.getByRole('dialog').evaluate(async dialog => {
        await Promise.allSettled(dialog.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await page.screenshot({ path: 'test-results/podium-tie-desktop.png' });
    await page.getByRole('button', { name: 'Zapisz kolejność' }).click();
    const anna = page.locator('.podium-group').filter({ has: page.getByRole('heading', { name: 'Anna', exact: true }) });
    await expect(anna.locator('li')).toHaveCount(3);
    await expect(anna.locator('li').nth(1)).toContainText('Finlandia');
    await expect(anna.locator('li .place')).toHaveText(['1','2','3']);
    const italy = page.locator('tbody tr').filter({ hasText: 'Włochy' });
    await expect(italy.locator('.rating-cell .medal-marker')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Włochy, Anna', exact: true })).toHaveValue('6,5');
    await expect(page.locator('.podium-group').first().locator('li')).toHaveCount(4);
    await page.getByRole('button', { name: 'Rozstrzygnij remis: Anna', exact: true }).click();
    await page.getByRole('button', { name: 'Przywróć wspólne miejsca' }).click();
    await expect(anna.locator('li .place')).toHaveText(['1','2','2','2']);
    expect(errors).toEqual([]);
});

test('mobile buttons support keyboard, cancellation and stale scores', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Rozstrzygnij remis: Anna', exact: true }).click();
    const up = page.getByRole('button', { name: 'Wyżej: Finlandia', exact: true });
    await up.focus(); await up.press('Enter');
    await expect(page.locator('.tie-order .tie-country')).toHaveText(['Francja','Finlandia','Włochy']);
    const box = await page.getByRole('dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.getByRole('dialog').evaluate(async dialog => {
        await Promise.allSettled(dialog.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await page.screenshot({ path: 'test-results/podium-tie-mobile.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(await page.evaluate(() => window.tieStore.state.contests.active.tieBreaks)).toBeUndefined();
    await page.getByRole('button', { name: 'Rozstrzygnij remis: Anna', exact: true }).click();
    await page.evaluate(() => window.tieStore.commit('contests/rating', { entryId: 'entry-3', voterId: 'anna', value: 7 }));
    await expect(page.getByRole('alert')).toContainText('Wyniki się zmieniły');
    await expect(page.getByRole('button', { name: 'Zapisz kolejność' })).toBeDisabled();
});

test('viewers see rankings without tie editing controls', async ({ page }) => {
    await page.goto('/?viewer');
    await expect(page.locator('.podium-group')).toHaveCount(2);
    await expect(page.locator('.tie-trigger')).toHaveCount(0);
});

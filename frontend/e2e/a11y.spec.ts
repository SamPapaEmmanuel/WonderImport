import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/dashboard', '/goods', '/clients', '/imports', '/reports', '/settings'];

/** WCAG 2.1 AA scan of every main screen, in light and dark themes. Serious and critical issues fail. */
for (const path of PAGES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${path} has no serious accessibility violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
}

test('sign-in page is accessible', async ({ browser }) => {
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } });
  await page.goto('/login');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.close();
});

test('keyboard: skip link, row activation, and Escape closes the drawer', async ({ page }) => {
  await page.goto('/goods');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

  const firstRow = page.locator('table tbody tr[tabindex="0"]').first();
  await firstRow.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/good=/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/good=/);
});

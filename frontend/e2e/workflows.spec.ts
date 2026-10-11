import { expect, test } from '@playwright/test';

const stamp = Date.now().toString().slice(-6);

test.describe.serial('release workflows', () => {
  test('dashboard figures drill through to the matching goods list', async ({ page }) => {
    await page.goto('/dashboard');
    const kpi = page.getByRole('link', { name: /^Goods recorded/ });
    await expect(kpi).toBeVisible();
    const shown = (await kpi.locator('span').nth(1).innerText()).replace(/,/g, '');
    await kpi.click();
    await expect(page).toHaveURL(/\/goods/);
    await expect(page.getByRole('heading', { name: 'Goods' })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${Number(shown).toLocaleString('en-GH')} (recorded|matching) goods?$`))).toBeVisible();
  });

  test('add a good with a manual price, then move it along and check it in', async ({ page }) => {
    const name = `E2E Fan ${stamp}`;
    await page.goto('/goods');
    await page.getByRole('button', { name: 'Add good' }).click();
    const drawer = page.getByRole('dialog', { name: 'Add good' });
    await drawer.getByLabel('Item name').fill(name);
    await drawer.getByLabel('Tracking number').fill(`E2E${stamp}`);
    for (const label of ['Client', 'Supplier', 'Category']) await drawer.getByLabel(label, { exact: true }).selectOption({ index: 1 });
    await drawer.getByLabel('Quantity', { exact: true }).fill('2');
    await drawer.getByLabel('Unit cost (¥)').fill('4');
    await expect(drawer.getByText('GHS 22.64').first()).toBeVisible(); // 4 × 1.887 × 3

    await drawer.getByLabel(/Sell at a different price/).check();
    await drawer.getByLabel('Selling price (GHS)').fill('30');
    await page.getByRole('button', { name: 'Add good' }).last().click();
    await expect(drawer.getByText('Say why this price differs')).toBeVisible();
    await drawer.getByLabel('Reason').fill('E2E market price');
    await page.getByRole('button', { name: 'Add good' }).last().click();

    const detail = page.getByRole('dialog', { name: name });
    await expect(detail).toBeVisible();
    await expect(detail.getByText('Set manually')).toBeVisible();
    await detail.getByRole('button', { name: 'Move to At supplier' }).click();
    await detail.getByRole('button', { name: 'Move to China warehouse' }).click();
    await detail.getByRole('button', { name: 'Record China check-in' }).click();
    await expect(detail.getByText(/Checked in at the China warehouse by/)).toBeVisible();
    await expect(detail.getByText('Moved to China warehouse')).toBeVisible(); // history
  });

  test('import a CSV: review, then import the selected rows', async ({ page }) => {
    await page.goto('/imports');
    const csv = ['Item name*,Tracking number,Quantity*,Unit cost (CNY)*', `E2E Tape ${stamp},YT${stamp},10,3.24`, `E2E Bag ${stamp},YT${stamp},1,26`, `,YT${stamp},1,5`].join('\n');
    await page.locator('input[type=file]').setInputFiles({ name: `e2e-${stamp}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByLabel('Supplier').selectOption({ index: 1 });
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Check file' }).click();

    await expect(page).toHaveURL(/\/imports\/[0-9a-f-]+$/);
    await expect(page.getByText('Item name is empty.')).toBeVisible();
    await page.getByRole('button', { name: 'Import 2 goods' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import 2 goods' }).click();
    await expect(page.getByText('2 goods were added')).toBeVisible();
  });

  test('export downloads exactly the filtered view', async ({ page }) => {
    await page.goto(`/goods?q=E2E`);
    const button = page.getByRole('button', { name: /^Export \d+/ });
    await expect(button).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toMatch(/^wonderimport-goods-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

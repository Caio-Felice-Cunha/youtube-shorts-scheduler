import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  const failures = [];
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) failures.push(`external request: ${request.url()}`);
  });
  page._caseFailures = failures;
});

test.afterEach(async ({ page }) => expect(page._caseFailures).toEqual([]));

test('replays schedule evidence and explains the guarded pipeline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Schedule logic/i })).toBeVisible();
  await expect(page.locator('#summary')).toContainText('3/3');
  await expect(page.locator('#items article')).toHaveCount(3);
  await expect(page.getByText('Scheduled:', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /Replay again/i }).click();
  await expect(page.getByText('schedule readback', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Seven stages guard', { exact: false })).toBeVisible();
  await expect(page.getByText('schedule mismatch', { exact: false }).first()).toBeVisible();
});

test('supports keyboard navigation, reduced motion, and narrow screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#demo')).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('WCAG AA audit passes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#items article').first().waitFor();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map((node) => node.target.join(' ')),
  }));
  expect(summary).toEqual([]);
});

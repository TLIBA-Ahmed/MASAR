import { expect, type Page } from '@playwright/test';

export async function chooseDemoWorkplace(page: Page, profile = 'p3') {
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await page
    .getByRole('list', { name: 'Les 24 gouvernorats' })
    .getByRole('button', { name: profile === 'p5' ? 'Gabès' : 'Siliana', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continuer vers la connexion', exact: true }).click();
  await expect(page.locator('.login-content select')).toBeEnabled();
  await page.locator('.login-content select').selectOption(profile);
}
export async function enterDemo(page: Page, profile = 'p3') {
  await page.goto('/');
  await chooseDemoWorkplace(page, profile);
  await page.getByRole('button', { name: 'S’identifier avec e-Houwiya', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Enfants pris en charge', exact: true }),
  ).toBeVisible();
}

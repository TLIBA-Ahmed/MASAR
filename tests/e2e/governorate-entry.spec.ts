import { test, expect } from '@playwright/test';
import { chooseDemoWorkplace } from './entry-helpers';

test('accueil : 24 territoires, clavier, sélection bilingue et login conservé sans GPS', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: () => {
          throw Error('GPS must not be used');
        },
        watchPosition: () => {
          throw Error('GPS must not be used');
        },
      },
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'كل مسار يبدأ من هنا.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.governorate-territories path')).toHaveCount(24);
  const shape = page.locator('[data-governorate="TN-34"]');
  const geometry = await shape.getAttribute('d');
  await shape.focus();
  await page.keyboard.press('Enter');
  await expect(shape).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '.tmp/welcome-governorates-ar.png', fullPage: true });
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await expect(
    page
      .getByRole('list', { name: 'Les 24 gouvernorats' })
      .getByRole('button', { name: 'Ben Arous', exact: true }),
  ).toBeVisible();
  await expect(shape).toHaveAttribute('d', geometry!);
  await expect(page.locator('.governorate-map')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.welcome-confirmation')).toContainText('Siliana');
  await page.getByRole('button', { name: 'Agrandir la carte' }).click();
  await page.getByRole('button', { name: 'Réinitialiser la carte' }).click();
  await page.screenshot({ path: '.tmp/welcome-governorates-fr.png', fullPage: true });
  await page.getByRole('button', { name: 'Continuer vers la connexion' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.login-workplace')).toContainText('Siliana');
  await expect(page.locator('.login-art .art-stage')).toHaveCount(5);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.locator('.login-content select')).toBeEnabled();
  await expect(page.locator('.login-content select option[value="p5"]')).toHaveCount(0);
  await page.locator('.login-content select').selectOption('p3');
  await page.screenshot({ path: '.tmp/login-governorate-fr.png', fullPage: true });
  await page.getByRole('button', { name: 'S’identifier avec e-Houwiya', exact: true }).click();
  await expect(page).toHaveURL(/\/assigned-children$/);
  await expect(page.locator('.assigned-group-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('retour interne : le dossier autorisé et son étape sont conservés après connexion', async ({
  page,
}) => {
  await page.goto('/child-journey/CDIS-024?stage=3');
  await expect(page).toHaveURL(/\/$/);
  await chooseDemoWorkplace(page);
  await page.getByRole('button', { name: 'S’identifier avec e-Houwiya', exact: true }).click();
  await expect(page).toHaveURL(/\/child-journey\/CDIS-024\?stage=3$/);
  await expect(page.locator('[data-summary-stage]')).toHaveCount(5);
  await expect(page.locator('.journey-child-header')).toContainText('CDIS-024');
});

test('retour interne : un autre centre ne peut pas ouvrir le dossier demandé', async ({ page }) => {
  await page.goto('/child-journey/CDIS-024');
  await chooseDemoWorkplace(page, 'p5');
  await page.getByRole('button', { name: 'S’identifier avec e-Houwiya', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accès refusé', exact: true })).toBeVisible();
  await expect(page.locator('[data-summary-stage]')).toHaveCount(0);
  const status = await page.evaluate(
    async () => (await fetch('/api/v1/cases/CDIS-024/journey')).status,
  );
  expect(status).toBe(404);
});

test('contexte falsifié : le backend refuse le centre et le formulaire permet de revenir', async ({
  page,
}) => {
  await page.goto('/');
  await chooseDemoWorkplace(page);
  await page.route('**/api/v1/auth/demo/login', async (route) => {
    await route.continue({
      postData: JSON.stringify({ employee_id: 'p3', governorate_id: 'TN-81', centre_id: 'gabes' }),
    });
  });
  await page.getByRole('button', { name: 'S’identifier avec e-Houwiya', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'ne correspond pas à vos affectations actives',
  );
  expect(await page.evaluate(async () => (await fetch('/api/v1/workspace')).status)).toBe(401);
  await page.getByRole('link', { name: 'Changer de gouvernorat', exact: true }).first().click();
  await expect(page.locator('.welcome-confirmation')).toContainText('Siliana');
});

test('mobile : liste recherchable, état vide et géométrie lisible sans débordement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Rechercher un gouvernorat' }).fill('Kebili');
  await page
    .getByRole('list', { name: 'Les 24 gouvernorats' })
    .getByRole('button', { name: 'Kébili', exact: true })
    .click();
  await expect(page.getByText(/Aucun centre de démonstration configuré/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer vers la connexion' })).toBeDisabled();
  await page.screenshot({ path: '.tmp/welcome-governorates-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

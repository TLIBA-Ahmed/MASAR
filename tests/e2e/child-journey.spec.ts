import { test, expect, type Page } from '@playwright/test';
import { enterDemo } from './entry-helpers';

async function login(page: Page, profile = 'p3') {
  await enterDemo(page, profile);
}

test('roadmap Tunisie : vraie 3D, filtres, dossier, panneau et bascule FR/AR', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await page
    .locator('.sidebar')
    .getByRole('link', { name: "Suivi du parcours de l'enfant", exact: true })
    .click();
  await expect(page.locator('.journey-child-card')).toHaveCount(6);
  await expect(page.locator('.journey-map-checkpoint')).toHaveCount(5);
  await expect(page.locator('.tunisia-map-viewport')).toHaveAttribute('data-mode', '3d');
  await expect(page.locator('.tunisia-webgl canvas')).toBeVisible();
  const checkpoint = page.locator('.checkpoint-2');
  const position = await checkpoint.evaluate((e) => (e as HTMLElement).style.left);
  await page.getByRole('button', { name: 'Tourner à droite', exact: true }).click();
  await expect
    .poll(() => checkpoint.evaluate((e) => (e as HTMLElement).style.left))
    .not.toBe(position);
  await page.getByRole('button', { name: 'Réinitialiser la vue', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Rechercher un parcours d’enfant' }).fill('CDIS-024');
  await expect(page.locator('.journey-child-card')).toHaveCount(1);
  await expect(page.locator('.journey-overview-total strong')).toHaveText('1');
  await page.locator('.journey-child-card').click();
  await expect(page).toHaveURL(/child-journey\/CDIS-024/);
  await page.locator('.journey-current-details > summary').click();
  await expect(page.locator('.journey-current-number')).toContainText('03');
  await expect(page.locator('.tunisia-webgl canvas')).toBeVisible();
  await page.locator('.checkpoint-3 > button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Réhabilitation et accompagnement', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.journey-substeps li')).toHaveCount(10);
  await expect(page.locator('.journey-form-links')).toContainText('F13');
  await expect(page.getByRole('dialog')).not.toContainText('F12');
  await page.getByRole('button', { name: 'Fermer les détails de l’étape', exact: true }).click();
  await page.waitForTimeout(650);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.tmp/journey-3d-fr.png' });
  await page.locator('.tunisia-map-card').screenshot({ path: '.tmp/tunisia-3d-detail.png' });
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'متابعة مسار الطفل', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.checkpoint-3 > button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/CDIS-024\?stage=3/);
  await page.screenshot({ path: '.tmp/journey-3d-ar.png' });
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('.tunisia-svg')).toBeVisible();
  const geometry = await page.locator('.tunisia-svg > g > path').first().getAttribute('d');
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await expect(page.locator('.tunisia-svg > g > path').first()).toHaveAttribute('d', geometry!);
  await expect(page.locator('.tunisia-map-viewport')).toHaveAttribute('dir', 'ltr');
  await page.screenshot({ path: '.tmp/journey-2d-fr.png' });
  await page
    .getByRole('combobox', { name: 'Type d’événement', exact: true })
    .selectOption('assessment');
  await page.locator('.journey-event-title').first().click();
  await expect(page.locator('.journey-map-checkpoint.is-selected')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('prolongation historique 4 vers 3 et étapes futures sans mutation du dossier', async ({
  page,
}) => {
  await login(page);
  await page.goto('/child-journey/CDIS-014');
  await expect(page.locator('.journey-cycles article')).toHaveCount(2);
  await expect(
    page.getByRole('heading', { name: 'Première prolongation', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.journey-plan-versions details')).toHaveCount(2);
  const before = await page.evaluate(async () =>
    (await fetch('/api/v1/cases/CDIS-014/journey')).json(),
  );
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.getByTestId('rehabilitation-loop-2d')).toBeVisible();
  await page.locator('.checkpoint-4 > button').click();
  await expect(page.getByRole('dialog')).toContainText('Le workflow avancé est futur dans ce PoC');
  await expect(page.getByRole('dialog')).toContainText('Première prolongation');
  await page.getByRole('button', { name: 'Suivante', exact: true }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Orientation et intégration', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fermer les détails de l’étape', exact: true }).click();
  const after = await page.evaluate(async () =>
    (await fetch('/api/v1/cases/CDIS-014/journey')).json(),
  );
  expect(after.stage).toBe(before.stage);
  expect(after.caseStatus).toBe(before.caseStatus);
  expect(after.versions).toEqual(before.versions);
  await page.screenshot({ path: '.tmp/journey-extension.png', fullPage: true });
});

test('orientation historique autorisée avec workflow futur et sans clôture automatique', async ({
  page,
}) => {
  await login(page, 'p2');
  await page.locator('.assigned-group-card').filter({ hasText: 'DEMO-B' }).click();
  await page
    .locator('.page-heading')
    .getByRole('link', { name: "Suivi du parcours de l'enfant", exact: true })
    .click();
  await expect(page).toHaveURL(/child-journey\?group=group-b/);
  await page.locator('.journey-child-card').filter({ hasText: 'CDIS-006' }).click();
  await page.locator('.journey-current-details > summary').click();
  await expect(page.locator('.journey-current-number')).toContainText('05');
  await expect(page.locator('.journey-current-panel')).toContainText(
    'État historique / workflow futur',
  );
  await page.locator('.checkpoint-5 > button').click();
  await expect(page.getByRole('dialog')).toContainText(
    'Orientation documentée — historique synthétique',
  );
  await expect(page.getByRole('dialog')).toContainText('Le workflow avancé est futur dans ce PoC');
  const data = await page.evaluate(async () =>
    (await fetch('/api/v1/cases/CDIS-006/journey')).json(),
  );
  expect(data.caseStatus).toBe('active');
  expect(data.events.some((e: { type: string }) => e.type === 'integration')).toBe(true);
  await page.getByRole('button', { name: 'Fermer les détails de l’étape', exact: true }).click();
  await page.getByRole('link', { name: 'Consulter le dossier', exact: true }).click();
  await page
    .locator('.case-identity')
    .getByRole('link', { name: "Suivi du parcours de l'enfant", exact: true })
    .click();
  await expect(page).toHaveURL(/child-journey\/CDIS-006/);
  await page.goto('/dashboard');
  await page
    .locator('.page-heading')
    .getByRole('link', { name: "Suivi du parcours de l'enfant", exact: true })
    .click();
  await expect(page.locator('.journey-child-card')).toHaveCount(10);
  await page.goto('/search');
  await page
    .getByRole('searchbox', { name: 'Saisissez votre question', exact: true })
    .fill('CDIS-006');
  const journeyLink = page.locator('.search-result-journey').first();
  await expect(journeyLink).toHaveAttribute('href', '/child-journey/CDIS-006');
  await journeyLink.click();
  await expect(page).toHaveURL(/child-journey\/CDIS-006/);
});

test('fallback 2D automatique, clavier et dossier interdit sans géométrie privée', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return type.includes('webgl') ? null : Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await login(page);
  await page.goto('/child-journey/CDIS-024');
  await expect(page.getByText(/La carte interactive 2D est activée/)).toBeVisible();
  await expect(page.locator('.tunisia-map-viewport')).toHaveAttribute('data-mode', '2d');
  await page.locator('.checkpoint-1 > button').focus();
  await expect(page.getByRole('tooltip')).toContainText('Enregistrement');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Enregistrement', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fermer les détails de l’étape', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.tunisia-svg')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: '.tmp/journey-mobile-2d.png', fullPage: true });
  await page.goto('/child-journey/CDIS-033');
  await expect(page.getByRole('heading', { name: 'Accès refusé', exact: true })).toBeVisible();
  await expect(page.locator('.tunisia-map-card')).toHaveCount(0);
});

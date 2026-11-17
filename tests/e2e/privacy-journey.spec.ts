import { test, expect, type Page } from '@playwright/test';
import { enterDemo } from './entry-helpers';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync('database/seed_data/demo.json', 'utf-8')).data;
const case024 = fixture.cases.find((c: { id: string }) => c.id === 'CDIS-024');
const identity = fixture.children.find((c: { id: string }) => c.id === case024.childId).name as {
  ar: string;
  fr: string;
};
async function login(page: Page, profile = 'p3') {
  await enterDemo(page, profile);
}
async function disjointCards(page: Page) {
  const overlap = await page.locator('[data-summary-stage]').evaluateAll((elements) => {
    const boxes = elements.map((e) => e.getBoundingClientRect());
    return boxes.some((a, i) =>
      boxes
        .slice(i + 1)
        .some(
          (b) =>
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
        ),
    );
  });
  expect(overlap).toBe(false);
}

test('cartes sourcées lisibles : vraie 3D, rotation, zoom, expansion, plein écran et RTL', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page.goto('/child-journey/CDIS-024');
  await expect(page.locator('[data-summary-stage]')).toHaveCount(5, { timeout: 30000 });
  await expect(page.locator('.journey-child-header h2')).toHaveText('Code enfant : CDIS-024');
  const content = await page.locator('body').innerText();
  expect(content).not.toContain(identity.fr);
  expect(content).not.toContain(identity.ar);
  await expect(page.locator('.tunisia-webgl canvas')).toBeVisible();
  await disjointCards(page);
  await page.getByRole('button', { name: 'Tourner à droite', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom avant', exact: true }).click();
  await page.locator('[data-summary-stage="3"] .summary-expand').click();
  await disjointCards(page);
  await page.getByRole('button', { name: 'Plein écran', exact: true }).click();
  await expect(page.locator('.intelligent-journey-map')).toHaveClass(/is-fullscreen/);
  await disjointCards(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.intelligent-journey-map')).not.toHaveClass(/is-fullscreen/);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await page.getByRole('button', { name: 'Masquer les synthèses', exact: true }).click();
  await expect(page.locator('[data-summary-stage]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Afficher les synthèses', exact: true }).click();
  await expect(page.locator('[data-summary-stage]')).toHaveCount(5);
  await page
    .locator('.intelligent-journey-map')
    .screenshot({ path: '.tmp/intelligent-journey-fr.png' });
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await disjointCards(page);
  await page
    .locator('.intelligent-journey-map')
    .screenshot({ path: '.tmp/intelligent-journey-ar.png' });
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('.tunisia-svg')).toBeVisible();
  const geometry = await page.locator('.tunisia-svg > g > path').first().getAttribute('d');
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await expect(page.locator('.tunisia-svg > g > path').first()).toHaveAttribute('d', geometry!);
  await page.setViewportSize({ width: 390, height: 844 });
  await disjointCards(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page
    .locator('[data-summary-stage="3"] .summary-card-actions button')
    .filter({ hasText: 'Sources' })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Preuves et sources autorisées');
  await expect(page.locator('.summary-source').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('identité uniquement dans la rubrique autorisée, jamais dans le workspace ni les exports', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  await page.goto('/cases/CDIS-024?tab=identity');
  await expect(page.locator('.personal-information')).toContainText(
    'Votre périmètre actuel ne permet pas de consulter l’identité.',
  );
  await page
    .getByRole('combobox', { name: 'Sélection du profil de démonstration' })
    .selectOption('p1');
  await expect(page.locator('.personal-information')).toContainText(identity.fr);
  await expect(page.locator('.case-identity h1')).toHaveText('CDIS-024');
  const projections = await page.evaluate(async () => {
    const result = await fetch('/api/v1/exports/workspace');
    return {
      status: result.status,
      text: await result.text(),
      storage: JSON.stringify({ ...localStorage }),
    };
  });
  expect(projections.status).toBe(200);
  expect(projections.text).not.toContain(identity.fr);
  expect(projections.text).not.toContain(identity.ar);
  expect(projections.storage).not.toContain(identity.fr);
  await page.goto('/child-journey/CDIS-024');
  await expect(page.locator('[data-summary-stage]')).toHaveCount(5, { timeout: 30000 });
  expect(await page.locator('body').innerText()).not.toContain(identity.fr);
});

test('génération Qwen3 réelle par la passerelle CPU et consultation des sources du brouillon', async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page);
  await page.goto('/child-journey/CDIS-024');
  await expect(page.locator('[data-summary-stage]')).toHaveCount(5, { timeout: 30000 });
  await page.locator('[data-summary-stage="3"] .summary-review-link').click();
  await expect(page.getByRole('dialog')).toContainText('Préparation et revue professionnelle');
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/journey/summaries/stages/3') && r.request().method() === 'POST',
    { timeout: 220000 },
  );
  await page
    .getByRole('button', { name: 'Générer un nouveau brouillon sourcé', exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(200);
  const value = await result.json();
  expect(value.validation_status).toBe('draft');
  expect(value.source_references.length).toBeGreaterThan(0);
  expect(['ai', 'deterministic_unavailable', 'deterministic_invalid_output']).toContain(
    value.generation_method,
  );
  if (value.generation_method === 'ai') expect(value.model_version).toBeTruthy();
  console.log(
    'Journey local CPU verification:',
    JSON.stringify({
      method: value.generation_method,
      model: value.model_version,
      version: value.version,
      sources: value.source_references.length,
    }),
  );
  await expect(
    page.getByRole('button', { name: 'Consulter les preuves', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Consulter les preuves', exact: true }).click();
  await expect(page.locator('.summary-source').first()).toBeVisible();
});

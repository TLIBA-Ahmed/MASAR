import { test, expect } from '@playwright/test';
import { enterDemo } from './entry-helpers';
async function login(page: import('@playwright/test').Page, profile = 'p3') {
  await enterDemo(page, profile);
}
test('Assigned Children, dossier et confidentialité des profils', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.locator('.assigned-group-card')).toHaveCount(1);
  await page.locator('.assigned-group-card').click();
  await expect(page.locator('.assigned-roster tbody tr')).toHaveCount(6);
  await page
    .locator('.assigned-roster tr')
    .filter({ hasText: 'CDIS-024' })
    .getByRole('link', { name: 'Ouvrir le dossier' })
    .click();
  await expect(page.locator('.case-journey')).toBeVisible();
  await expect(page.locator('.journey-stepper button')).toHaveCount(5);
  const data = await page.evaluate(async () => await (await fetch('/api/v1/workspace')).json());
  expect(data.cases).toHaveLength(6);
  expect(data.submissions.some((s: { formId: string }) => s.formId === 'F12')).toBe(false);
  await page
    .getByRole('combobox', { name: 'Sélection du profil de démonstration' })
    .selectOption('p6');
  await expect(
    page.getByRole('combobox', { name: 'Sélection du profil de démonstration' }),
  ).toHaveValue('p6');
  await page.goto('/recommendations?context=workshops&case=CDIS-024');
  await expect(page.getByText('Aucun contexte disponible pour cette affectation')).toBeVisible();
  await page.goto('/network');
  await expect(page.getByRole('heading', { name: 'Forum', exact: true })).toBeVisible();
  await expect(
    page.locator('.sidebar').getByRole('link', { name: 'Forum', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Messagerie', exact: true }).click();
  await expect(page.getByText('Aucune conversation', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Forum visible, publications persistantes et interface bilingue', async ({ page }) => {
  await login(page);
  await page.locator('.sidebar').getByRole('link', { name: 'Forum', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forum', exact: true })).toBeVisible();
  const body = `Ressource générale de démonstration Forum ${Date.now()}`;
  await page.getByRole('button', { name: 'Nouvelle publication', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill(body);
  await page.getByRole('button', { name: 'Publier localement', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const post = page.locator('.post-card').filter({ hasText: body });
  await expect(post).toBeVisible();
  await post
    .getByRole('textbox', { name: 'Commentaire local', exact: true })
    .fill('Échange général de démonstration.');
  await post.getByRole('button', { name: 'Enregistrer le commentaire', exact: true }).click();
  await expect(post.locator('.post-comments')).toContainText('Échange général de démonstration.');
  await post.getByRole('button', { name: /réactions/ }).click();
  await expect(post.getByRole('button', { name: /réactions/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await post.getByRole('button', { name: 'Enregistrer la publication', exact: true }).click();
  await expect(
    post.getByRole('button', { name: 'Enregistrer la publication', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(post).toBeVisible();
  await page.screenshot({ path: '.tmp/forum-fr.png' });
  await page.getByRole('button', { name: 'Enregistrés', exact: true }).click();
  await expect(post).toBeVisible();
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'المنتدى', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(post).toContainText(body);
  await page.screenshot({ path: '.tmp/forum-ar.png' });
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await page.getByRole('button', { name: 'Messagerie', exact: true }).click();
  await expect(page.locator('.conversation')).toBeVisible();
  const message = `Message général de démonstration Forum ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill(message);
  await page.getByRole('button', { name: 'Enregistrer localement', exact: true }).click();
  await expect(page.locator('.message-list')).toContainText(message);
  await page.reload();
  await expect(page.locator('.message-list')).toContainText(message);
});
test('Recherche instantanée API, autorisations et bascule RTL/LTR', async ({ page }) => {
  await login(page);
  const input = page.getByRole('searchbox', { name: 'Recherche globale MASAR' });
  await input.fill('CDIS-024');
  await expect(page.locator('.instant-search-popover .search-result').first()).toBeVisible();
  await expect(page.locator('.instant-search-popover mark').first()).toBeVisible();
  await input.fill('CDIS-035');
  await expect(page.locator('.instant-search-popover .search-result')).toHaveCount(0);
  await expect(page.getByText('0 résultats autorisés')).toBeVisible();
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('searchbox').fill('التعاون');
  await expect(page.locator('.instant-search-popover .search-result').first()).toBeVisible();
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
test('Recommandation CPU locale et avis humain sans planification automatique', async ({
  page,
}) => {
  test.setTimeout(150000);
  await login(page);
  await page.goto('/recommendations?context=educational-resources&case=CDIS-024');
  const before = await page.evaluate(async () => {
    const data = await (await fetch('/api/v1/workspace')).json();
    return data.cases.find((c: { id: string }) => c.id === 'CDIS-024').roadmapVersion;
  });
  await page.getByRole('button', { name: 'Générer les recommandations', exact: true }).click();
  await expect(page.locator('.proposal-card').first()).toBeVisible({ timeout: 125000 });
  await page
    .locator('.proposal-card')
    .first()
    .getByRole('button', { name: 'Accepter', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('textbox')
    .fill('Avis de démonstration motivé, sans planification.');
  await page.getByRole('button', { name: 'Enregistrer l’avis', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await page.evaluate(async () => {
    const data = await (await fetch('/api/v1/workspace')).json();
    return data.cases.find((c: { id: string }) => c.id === 'CDIS-024').roadmapVersion;
  });
  expect(after).toBe(before);
  await page
    .getByRole('combobox', { name: 'Sélection du profil de démonstration' })
    .selectOption('p6');
  await expect(page.locator('.proposal-card')).toHaveCount(0);
});
test('Browser : calcul relationnel autorisé et réponse locale sourcée', async ({ page }) => {
  test.setTimeout(150000);
  await login(page);
  await page.goto('/search');
  await page.getByLabel('Type de réponse').selectOption('group_count');
  await page.getByRole('combobox', { name: 'Groupe', exact: true }).selectOption('group-a');
  await page.getByRole('button', { name: 'Poser la question', exact: true }).click();
  await expect(page.locator('.ai-answer')).toContainText('6');
  await page.getByLabel('Type de réponse').selectOption('');
  await page
    .getByRole('searchbox', { name: 'Saisissez votre question' })
    .fill('Quelles ressources aident la communication et la coopération ?');
  await page.getByRole('button', { name: 'Poser la question', exact: true }).click();
  await expect(page.locator('.ai-answer .ai-source-list a').first()).toBeVisible({
    timeout: 125000,
  });
});

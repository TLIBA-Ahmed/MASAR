import { test, expect, type Page } from '@playwright/test';
import { enterDemo } from './entry-helpers';

async function login(page: Page) {
  await enterDemo(page);
  await page.locator('.sidebar').getByRole('link', { name: 'Forum', exact: true }).click();
}

test('Forum : documents joints aux publications, commentaires et messages, téléchargement autorisé', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  const text =
    'Guide general pour un atelier collectif.\nRessource professionnelle sans information individuelle.';
  const body = 'Partage de documents pedagogiques ' + Date.now();
  await page.getByRole('button', { name: 'Nouvelle publication', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Votre publication').fill(body);
  await page
    .getByRole('dialog')
    .getByLabel('Joindre un document', { exact: true })
    .setInputFiles({
      name: 'atelier-forum.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(text),
    });
  await expect(page.getByRole('dialog')).toContainText('atelier-forum.txt');
  await page.getByRole('button', { name: 'Publier localement', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const post = page.locator('.post-card').filter({ hasText: body });
  await expect(post.getByText('atelier-forum.txt', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  const downloading = page.waitForEvent('download');
  await post.getByRole('button', { name: 'Télécharger atelier-forum.txt' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('atelier-forum.txt');
  expect(await download.failure()).toBeNull();
  await page.reload();
  await expect(post.getByText('atelier-forum.txt', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await post
    .getByLabel('Joindre au commentaire')
    .setInputFiles({
      name: 'notes-atelier.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Notes generales pour les ateliers collectifs.'),
    });
  await post.getByRole('button', { name: 'Enregistrer le commentaire' }).click();
  await expect(post.getByRole('button', { name: 'Télécharger notes-atelier.txt' })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(post.getByRole('button', { name: 'تنزيل atelier-forum.txt' })).toBeVisible();
  await page.screenshot({ path: '.tmp/forum-attachments-ar.png', fullPage: true });
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await page.getByRole('button', { name: 'Messagerie', exact: true }).click();
  await expect(page.locator('.conversation')).toBeVisible();
  const messageFile = `ressource-equipe-${Date.now()}.txt`;
  await page
    .getByLabel('Joindre au message')
    .setInputFiles({
      name: messageFile,
      mimeType: 'text/plain',
      buffer: Buffer.from('Ressource generale pour une reunion equipe.'),
    });
  await page.getByRole('button', { name: 'Enregistrer localement', exact: true }).click();
  await expect(
    page.locator('.message-list').getByRole('button', { name: `Télécharger ${messageFile}` }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole('combobox', { name: 'Sélection du profil de démonstration' })
    .selectOption('p6');
  await expect(page.getByText('Aucune conversation', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.getByRole('button', { name: 'الدخول عبر الهوية الرقمية' }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('masar-demo-v1', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('state', 'readonly');
    const read = tx.objectStore('state').get('app');
    const value = await new Promise<unknown>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    db.close();
    return value;
  });
}

test('recherche globale instantanée, source directe et changement de périmètre', async ({
  page,
}) => {
  await login(page);
  await page.goto('/library');
  const global = page.getByRole('searchbox', { name: 'البحث الشامل في مسار' });
  await global.fill('CDIS-035');
  await expect(page.locator('.instant-search-status')).toContainText('0');
  await expect(page.locator('.instant-search-popover .search-result')).toHaveCount(0);
  await global.fill('CDIS-024');
  await expect(page.locator('.instant-search-popover .search-result').first()).toBeVisible();
  await expect(page.locator('.instant-search-popover mark').first()).toBeVisible();
  await page.screenshot({ path: '.tmp/qa-global-search-ar.png', fullPage: true });
  await page.locator('.instant-search-popover .search-result').first().click();
  await expect(page).toHaveURL(/cases\/CDIS-024/);
  await page.getByRole('combobox', { name: 'اختيار الملف المهني التجريبي' }).selectOption('p5');
  await expect(global).toHaveValue('');
  await expect(page.locator('.instant-search-popover')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'الملف غير متاح في نطاقك' })).toBeVisible();
  await page
    .locator('.language-switch')
    .getByRole('button', { name: 'Français', exact: true })
    .click();
  const french = page.getByRole('searchbox', { name: 'Recherche globale MASAR' });
  await french.fill('CDIS-035');
  await expect(page.locator('.instant-search-popover .search-result').first()).toBeVisible();
  await french.press('Enter');
  await expect(page).toHaveURL(/search\?q=CDIS-035/);
  await expect(page.locator('main .search-result').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('CDIS-024');
});

test('contextes métier, saisie bilingue, révocation et ressource validée dans le dossier', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('combobox', { name: 'اختيار الملف المهني التجريبي' }).selectOption('p3');
  await page.goto('/recommendations?context=workshops&case=CDIS-024&activity=ACT-001');
  await page.getByRole('button', { name: 'إعداد التوصيات', exact: true }).click();
  await expect(page.locator('.recommendation-card')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.tmp/qa-intelligence-recommendations-ar.png', fullPage: true });
  await page.getByRole('button', { name: 'المشروع التربوي الإفرادي', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'المشروع الموجود' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'نطاق النشاط' })).toHaveCount(0);
  await expect(page.locator('.recommendation-card')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'طلب مكمل (اختياري)' }).fill('ملاحظة مهنية أصلية');
  await page
    .locator('.language-switch')
    .getByRole('button', { name: 'Français', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Demande complémentaire (facultatif)' }),
  ).toHaveValue('ملاحظة مهنية أصلية');
  await page.getByRole('button', { name: 'Générer les recommandations', exact: true }).click();
  await expect(page.locator('.recommendation-card').first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.tmp/qa-intelligence-project-fr.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('searchbox', { name: 'Recherche globale MASAR' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.tmp/qa-intelligence-mobile-fr.png', fullPage: true });
  await page
    .getByRole('combobox', { name: 'Sélection du profil de démonstration' })
    .selectOption('p6');
  await expect(page.locator('.recommendation-card')).toHaveCount(0);
  await expect(page.locator('.context-choice[aria-pressed=true]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Ateliers et activités', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Ressources éducatives', exact: true }).click();
  await page.getByRole('button', { name: 'Générer les recommandations', exact: true }).click();
  await expect(page.locator('.recommendation-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Adapter', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Adaptation et motif')
    .fill('Support visuel fictif choisi après examen professionnel.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer la revue professionnelle' })
    .click();
  await expect(page.getByText('Ajoutée au dossier après votre revue')).toBeVisible();
  await expect
    .poll(async () => JSON.stringify(await snapshot(page)))
    .toContain('Support visuel fictif choisi après examen professionnel.');
  await page.goto('/cases/CDIS-024?tab=history');
  await expect(
    page.getByText(/Support visuel fictif choisi après examen professionnel/),
  ).toBeVisible();
});
test('connexion arabe, tableau de bord calculé et cinq étapes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.screenshot({ path: '.tmp/qa-login-ar.png', fullPage: true });
  await page.getByRole('button', { name: 'الدخول عبر الهوية الرقمية' }).click();
  await expect(page.getByRole('heading', { name: 'أين وصل الأطفال في مسارهم؟' })).toBeVisible();
  await expect(page.locator('.kpi-value').first()).toHaveText('32');
  await expect(page.locator('.stage-summary>a')).toHaveCount(5);
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.screenshot({ path: '.tmp/qa-dashboard-ar.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('création, préremplissage, brouillon bilingue et document historique', async ({ page }) => {
  await login(page);
  await page.goto('/cases?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/الاسم واللقب بالعربية/).fill('طفل اصطناعي للاختبار');
  await dialog.getByLabel('الاسم بالفرنسية').fill('Enfant Fictif Test');
  await dialog.getByLabel('تاريخ الولادة').fill('2013-04-10');
  await dialog.getByRole('button', { name: 'التالي' }).click();
  await dialog.getByLabel('عنوان اصطناعي').fill('Adresse fictive initiale');
  await dialog.getByLabel('مصدر الإحالة').fill('École fictive');
  await dialog.getByRole('button', { name: 'التالي' }).click();
  await dialog.getByRole('button', { name: 'تأكيد فتح الملف' }).click();
  await expect(page).toHaveURL(/cases\/CDIS-041/);
  await page.goto('/documents/CDIS-041/F01');
  await expect(page.getByRole('textbox', { name: 'العنوان', exact: true })).toHaveValue(
    'Adresse fictive initiale',
  );
  await page
    .locator('.form-section-nav')
    .getByRole('button', { name: /الملاحظات المهنية/ })
    .click();
  await page
    .getByRole('textbox', { name: 'الملاحظات', exact: true })
    .fill('ملاحظة أصلية لا تتغير مع اللغة');
  await page
    .locator('.language-switch')
    .getByRole('button', { name: 'Français', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('textbox', { name: 'Observations', exact: true })).toHaveValue(
    'ملاحظة أصلية لا تتغير مع اللغة',
  );
  await page.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click();
  await expect
    .poll(async () => JSON.stringify(await snapshot(page)))
    .toContain('ملاحظة أصلية لا تتغير مع اللغة');
  await page.reload();
  await page
    .locator('.form-section-nav')
    .getByRole('button', { name: /Observations professionnelles/ })
    .click();
  await expect(page.getByRole('textbox', { name: 'Observations', exact: true })).toHaveValue(
    'ملاحظة أصلية لا تتغير مع اللغة',
  );
  await page.getByRole('button', { name: 'Valider (simulation)', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer la validation simulée' })
    .click();
  await expect(page).toHaveURL(/version=/);
  await page.goto('/cases/CDIS-041');
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Adresse fictive').fill('Adresse fictive actualisée');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.goto('/documents/CDIS-041/F11');
  await expect(page.getByRole('textbox', { name: 'Adresse', exact: true })).toHaveValue(
    'Adresse fictive actualisée',
  );
  await page.goto('/documents/CDIS-041/F01');
  await expect(page.getByRole('textbox', { name: 'Adresse', exact: true })).toHaveValue(
    'Adresse fictive initiale',
  );
  await expect(page.getByRole('textbox', { name: 'Adresse', exact: true })).toBeDisabled();
});
test('recommandation acceptée, séance et réutilisation F05 / F06', async ({ page }) => {
  await login(page);
  await page.getByRole('combobox', { name: 'اختيار الملف المهني التجريبي' }).selectOption('p3');
  await page.goto('/recommendations?context=workshops&case=CDIS-024&activity=ACT-001');
  await page.getByRole('button', { name: 'إعداد التوصيات', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'بطاقات المشاعر', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'المدة القصوى بالدقائق', exact: true }).fill('10');
  await page.getByRole('button', { name: 'إعداد التوصيات', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'لا توجد اقتراحات مطابقة لهذه المعطيات', exact: true }),
  ).toBeVisible();
  await page.getByRole('spinbutton', { name: 'المدة القصوى بالدقائق', exact: true }).fill('60');
  await page.getByRole('button', { name: 'إعداد التوصيات', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'بطاقات المشاعر', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'قبول وبرمجة', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('مبرر القبول والتكييف المهني')
    .fill('مراجعة مهنية اصطناعية لملاءمة النشاط.');
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد القبول والبرمجة' }).click();
  await expect(page.getByRole('link', { name: 'متابعة الحصة', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'متابعة الحصة', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByLabel(/الملاحظات المهنية/)
    .fill('مشاركة اصطناعية موثقة أثناء الحصة');
  await page.getByRole('dialog').getByLabel('التقدم الملاحظ').fill('عبّر عن فكرة واحترم دوره');
  await page.getByRole('dialog').getByRole('button', { name: 'تسجيل إنجاز تجريبي' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/cases/CDIS-024?tab=history');
  await expect(page.getByText(/مشاركة اصطناعية موثقة أثناء الحصة/)).toBeVisible();
  await page.goto('/documents/CDIS-024/F05');
  await page.locator('.form-section-nav button').nth(1).click();
  await expect
    .poll(() =>
      page
        .locator('.input-table input')
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value).join('\n')),
    )
    .toContain('مشاركة اصطناعية موثقة أثناء الحصة');
  await page.goto('/documents/CDIS-024/F06');
  await expect
    .poll(() =>
      page
        .locator('.input-table input')
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value).join('\n')),
    )
    .toContain('مشاركة اصطناعية موثقة أثناء الحصة');
  await page.goto('/recommendations?context=workshops&case=CDIS-024&activity=ACT-001');
  await page.getByRole('button', { name: 'إعداد التوصيات', exact: true }).click();
  await expect(page.getByRole('button', { name: 'قبول وبرمجة', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'متابعة الحصة', exact: true })).toBeVisible();
});
test('recherche dans le périmètre, réseau local et agrégats anonymes', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:5174') && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  await login(page);
  await page.goto('/search');
  const box = page.getByRole('searchbox', { name: 'اكتب سؤالك' });
  await box.fill('اعرض الملفات التي تحتاج إلى تقييم أولي');
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await expect(page.locator('.search-result')).not.toHaveCount(0);
  await box.fill('CDIS-035');
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'لا توجد نتائج ضمن نطاقك' })).toBeVisible();
  await page.goto('/cases/CDIS-035');
  await expect(page.getByRole('heading', { name: 'الملف غير متاح في نطاقك' })).toBeVisible();
  await page.goto('/national');
  await expect(page.locator('.kpi-value').first()).toHaveText('40');
  await expect(page.locator('main')).not.toContainText('CDIS-024');
  await expect(page.locator('main')).not.toContainText('آدم');
  await page.goto('/network');
  await page.getByRole('button', { name: 'مشاركة جديدة', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/محتوى المشاركة/)
    .fill('مورد تربوي اصطناعي عام للاختبار');
  await page.getByRole('dialog').getByRole('button', { name: 'مشاركة محلية', exact: true }).click();
  await expect(page.getByText('مورد تربوي اصطناعي عام للاختبار', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('مورد تربوي اصطناعي عام للاختبار', { exact: true })).toBeVisible();
  expect(external).toEqual([]);
});
test('décision motivée et prolongation sans effacer les évaluations', async ({ page }) => {
  await login(page);
  await page.goto('/cases/CDIS-024');
  await page.getByRole('button', { name: 'قرار المسار', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/سبب القرار/)
    .fill('عرض تجريبي أمام اللجنة');
  await page.getByRole('dialog').getByRole('button', { name: 'توثيق القرار' }).click();
  await page.goto('/professionals');
  await page
    .locator('.professional-card')
    .filter({ hasText: 'سناء الهمامي' })
    .getByRole('button', { name: 'تجربة الهوية' })
    .click();
  await expect(
    page.locator('.professional-card').filter({ hasText: 'سناء الهمامي' }),
  ).toContainText('هويتك الحالية');
  await page.goto('/cases/CDIS-024');
  await page.getByRole('button', { name: 'قرار المسار', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'القرار', exact: true })
    .selectOption('extend');
  await page
    .getByRole('dialog')
    .getByLabel(/سبب القرار/)
    .fill('تمديد اصطناعي مع حفظ التقييمات السابقة');
  await page.getByRole('dialog').getByRole('button', { name: 'توثيق القرار' }).click();
  await expect(page.locator('.case-meta')).toContainText('دورة التأهيل 2');
  await page.getByRole('tab', { name: 'التقييم متعدد الاختصاصات', exact: true }).click();
  await expect(page.locator('.assessment-comparison article')).toHaveCount(2);
  await page.getByRole('tab', { name: 'سجل المتابعة', exact: true }).click();
  await expect(
    page.getByText('تمديد اصطناعي مع حفظ التقييمات السابقة', { exact: true }),
  ).toBeVisible();
});
test('navigation complète, français, thème sombre et vues mobiles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  const routes = [
    'cases',
    'journey',
    'tasks',
    'calendar',
    'interviews',
    'assessments',
    'projects',
    'interventions',
    'sessions',
    'attendance',
    'integration',
    'search',
    'recommendations',
    'library',
    'network',
    'documents',
    'supervision',
    'national',
    'reports',
    'professionals',
    'settings',
  ];
  for (const route of routes) {
    await page.goto('/' + route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/' + route + '$'));
    await expect(page.locator('main h1')).not.toHaveCount(0);
  }
  await page.goto('/dashboard');
  await page
    .locator('.language-switch')
    .getByRole('button', { name: 'Français', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.sidebar')).toHaveCSS('direction', 'ltr');
  await page.screenshot({ path: '.tmp/qa-dashboard-fr.png', fullPage: true });
  await page.getByRole('button', { name: 'Changer le thème' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: '.tmp/qa-dashboard-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Changer le thème' }).click();
  await page
    .locator('.language-switch')
    .getByRole('button', { name: 'العربية', exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    'dashboard',
    'cases',
    'calendar',
    'recommendations',
    'library',
    'network',
    'national',
  ]) {
    await page.goto('/' + route);
    await expect(page.locator('main')).toBeVisible();
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            document: document.documentElement.scrollWidth,
            viewport: innerWidth,
            wide: [...document.querySelectorAll('body *')]
              .filter(
                (e) => e.getBoundingClientRect().width > innerWidth + 1 && !e.closest('.sidebar'),
              )
              .map((e) => ({
                tag: e.tagName,
                cl: String(e.className),
                width: e.getBoundingClientRect().width,
              }))
              .slice(0, 15),
          })),
        { message: route },
      )
      .toMatchObject({ document: 390, viewport: 390 });
  }
  await page.goto('/dashboard');
  await expect(page.locator('main h1')).toBeVisible();
  await page.screenshot({ path: '.tmp/qa-mobile-ar.png', fullPage: true });
  await page.getByRole('button', { name: 'إظهار القائمة' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/mobile-open/);
  expect(errors).toEqual([]);
});

test('rendez-vous, messages locaux, impression et réinitialisation confirmée', async ({ page }) => {
  await login(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'موعد جديد', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/عنوان الموعد/)
    .fill('موعد اصطناعي لاختبار المتابعة');
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'الملف المرتبط', exact: true })
    .selectOption('CDIS-024');
  await page
    .getByRole('dialog')
    .getByLabel(/^التاريخ/)
    .fill('2026-11-16');
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.locator('.calendar-day').getByText('16', { exact: true }).click();
  await expect(
    page
      .locator('.calendar-agenda')
      .getByRole('heading', { name: 'موعد اصطناعي لاختبار المتابعة' }),
  ).toBeVisible();
  await page.goto('/network?tab=messages');
  await page
    .getByRole('textbox', { name: 'الرسالة', exact: true })
    .fill('رسالة اصطناعية عامة للفريق');
  await page.getByRole('button', { name: 'حفظ محلي', exact: true }).click();
  await expect(page.locator('.message-list')).toContainText('رسالة اصطناعية عامة للفريق');
  await page.reload();
  await expect(page.locator('.message-list')).toContainText('رسالة اصطناعية عامة للفريق');
  await page.goto('/documents/CDIS-024/F03');
  await page.getByRole('button', { name: 'معاينة وطباعة', exact: true }).click();
  await expect(page.locator('.print-document')).toBeVisible();
  await expect(page.locator('.print-document')).toContainText('بيانات اصطناعية بالكامل');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-shell')).toHaveCSS('display', 'none');
  await expect(page.locator('.print-document')).toBeVisible();
  await page.screenshot({ path: '.tmp/qa-document-print.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق', exact: true }).last().click();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'إعادة التهيئة', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء', exact: true }).click();
  expect(JSON.stringify(await snapshot(page))).toContain('رسالة اصطناعية عامة للفريق');
  await page.getByRole('button', { name: 'إعادة التهيئة', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'تأكيد الاستعادة', exact: true })
    .click();
  await expect
    .poll(async () => JSON.stringify(await snapshot(page)))
    .not.toContain('رسالة اصطناعية عامة للفريق');
});

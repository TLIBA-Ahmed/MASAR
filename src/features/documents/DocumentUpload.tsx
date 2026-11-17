import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { api, csrfHeader } from '../../services/api';
import { Button, Field, Info, Modal, useToast } from '../../components/ui';
export function DocumentUpload({ caseId }: { caseId: string }) {
  const { data, refresh } = useWorkspace();
  const { l, lang } = useLocale();
  const toast = useToast();
  const [open, setOpen] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(''),
    [category, setCategory] = useState(''),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(''),
    [reason, setReason] = useState('');
  const categories = Object.keys(data.backend?.access[caseId]?.categories ?? {}).filter(
    (cat) =>
      ['social', 'psychological', 'educational', 'assessment', 'administrative'].includes(cat) &&
      data.backend?.access[caseId]?.categories[cat].write,
  );
  const labels: Record<string, string> = {
    social: l('اجتماعي', 'Social'),
    psychological: l('نفسي', 'Psychologique'),
    educational: l('تربوي', 'Éducatif'),
    assessment: l('تقييم', 'Évaluation'),
    administrative: l('إداري', 'Administratif'),
  };
  if (!categories.length) return null;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
          setCategory(categories[0]);
        }}
      >
        <FileUp size={16} />
        {l('إضافة وثيقة اصطناعية', 'Ajouter un document synthétique')}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={l('وثيقة خاصة مرتبطة بالملف', 'Document privé lié au dossier')}
      >
        <Info>
          {l(
            'PDF نصي أو ملف نصي UTF-8، حتى 8 ميغابايت. استخدم وثيقة اصطناعية فقط. يلزم تأكيد مهني قبل فهرستها.',
            'PDF contenant du texte ou fichier texte UTF-8, 8 Mo maximum. Documents synthétiques uniquement. Une approbation professionnelle précède l’indexation.',
          )}
        </Info>
        {!version ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!file) return;
              setBusy(true);
              const body = new FormData();
              body.append('file', file);
              body.append('case_id', caseId);
              body.append('category', category);
              body.append('title', title);
              body.append('language', lang);
              void api<{ version_id: string }>('/documents/upload', undefined, {
                method: 'POST',
                body,
                headers: { 'X-Masar-CSRF': csrfHeader() },
              })
                .then((r) => setVersion(r.version_id))
                .catch(() =>
                  toast(
                    l(
                      'تعذر إضافة الوثيقة. تحقق من النوع والحجم والصلاحيات.',
                      'Ajout refusé. Vérifiez le format, la taille et les accès.',
                    ),
                    true,
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            <Field label={l('عنوان الوثيقة', 'Titre du document')}>
              <input
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label={l('الفئة', 'Catégorie')}>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {labels[cat]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l('الملف الاصطناعي', 'Fichier synthétique')}>
              <input
                required
                type="file"
                accept="application/pdf,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Button type="submit" disabled={busy || !file || file.size > 8 * 1024 * 1024}>
              {l('حفظ نسخة أولية', 'Enregistrer le brouillon')}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void api(`/document-versions/${version}/approve`, { reason })
                .then(async () => {
                  await refresh();
                  setOpen(false);
                  setVersion('');
                  setFile(null);
                  setTitle('');
                  setReason('');
                  toast(
                    l(
                      'حُفظت المصادقة. ستُفهرس الوثيقة بواسطة العامل المحلي.',
                      'Approbation enregistrée. Le worker local indexera le document.',
                    ),
                  );
                })
                .catch(() => toast(l('تعذرت المصادقة.', 'Approbation refusée.'), true))
                .finally(() => setBusy(false));
            }}
          >
            <a
              className="text-link"
              href={`/api/v1/document-versions/${version}/original`}
              target="_blank"
              rel="noreferrer"
            >
              {l('مراجعة الأصل', 'Consulter l’original')}
            </a>
            <Field
              label={l(
                'مبرر المصادقة المهنية التجريبية',
                'Motif de l’approbation professionnelle de démonstration',
              )}
            >
              <textarea
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {l('تأكيد المصادقة والفهرسة', 'Confirmer l’approbation et l’indexation')}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}

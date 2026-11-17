import { useEffect, useState } from 'react';
import { ShieldCheck, LockKeyhole } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { api } from '../../services/api';
import { useJourneyResource } from '../child-journey/useJourneyResource';
import { Panel, SectionHeading, Info, Button, Field } from '../../components/ui';
import type { Bi } from '../../types';

interface ChildIdentityDTO {
  child_code: string;
  first_name: Bi | null;
  last_name: Bi | null;
  birth_date: string | null;
  personal_information: Record<string, string | Bi>;
  version: number;
}

/** Deliberately component-local: never stored in the workspace, IndexedDB or exports. */
export function PersonalInformation({ caseId }: { caseId: string }) {
  const { l, b, date } = useLocale();
  const { data } = useWorkspace();
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  const {
    data: identity,
    error,
    retry,
  } = useJourneyResource<ChildIdentityDTO>(
    visible ? `/cases/${encodeURIComponent(caseId)}/identity` : null,
  );
  return (
    <Panel className="detail-info personal-information">
      <SectionHeading
        title={l('البيانات الشخصية', 'Informations personnelles')}
        subtitle={l('وصول منفصل ومراقب ومسجل', 'Accès distinct, contrôlé et journalisé')}
      />
      <Info>
        <LockKeyhole size={16} />
        {l(
          'لا تُعرض الهوية إلا في هذا القسم وبحسب التكليف والصلاحيات الحالية.',
          'L’identité est consultable dans cette rubrique selon les affectations et droits actifs.',
        )}
      </Info>
      {error ? (
        <Info tone="orange">
          {l(
            'لا يسمح نطاقك الحالي باستشارة الهوية.',
            'Votre périmètre actuel ne permet pas de consulter l’identité.',
          )}
        </Info>
      ) : !identity ? (
        <p role="status">{l('التحقق من الصلاحيات…', 'Vérification des droits…')}</p>
      ) : (
        <>
          <dl className="details-grid">
            {[
              [l('الرمز الدائم', 'Code permanent'), identity.child_code],
              [
                l('الاسم المسجل', 'Nom enregistré'),
                typeof identity.personal_information.name === 'object'
                  ? b(identity.personal_information.name)
                  : '—',
              ],
              [l('الاسم', 'Prénom'), identity.first_name ? b(identity.first_name) : '—'],
              [l('اللقب', 'Nom de famille'), identity.last_name ? b(identity.last_name) : '—'],
              [l('تاريخ الولادة', 'Date de naissance'), date(identity.birth_date ?? '')],
              ...(['address', 'phone', 'father', 'mother', 'school'] as const).map((key, i) => [
                [
                  l('العنوان', 'Adresse'),
                  l('الهاتف', 'Téléphone'),
                  l('الأب', 'Père'),
                  l('الأم', 'Mère'),
                  l('المؤسسة', 'Établissement'),
                ][i],
                String(identity.personal_information[key] ?? '—'),
              ]),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="narrative">{value}</dd>
              </div>
            ))}
          </dl>
          {data.backend?.access[caseId]?.identity?.write && (
            <IdentityEditor
              key={identity.version}
              identity={identity}
              caseId={caseId}
              onSaved={retry}
            />
          )}
        </>
      )}
    </Panel>
  );
}

function IdentityEditor({
  identity,
  caseId,
  onSaved,
}: {
  identity: ChildIdentityDTO;
  caseId: string;
  onSaved: () => void;
}) {
  const { l } = useLocale();
  const [editing, setEditing] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const existing = identity.personal_information.name;
  const [draft, setDraft] = useState({
    ar: typeof existing === 'object' ? existing.ar : '',
    fr: typeof existing === 'object' ? existing.fr : '',
    birthDate: identity.birth_date ?? '',
    address: String(identity.personal_information.address ?? ''),
    phone: String(identity.personal_information.phone ?? ''),
  });
  if (!editing)
    return (
      <Button variant="secondary" onClick={() => setEditing(true)}>
        <ShieldCheck size={16} />
        {l('تعديل الهوية المصرح به', 'Modifier l’identité autorisée')}
      </Button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setPending(true);
        setError(false);
        void api(
          `/cases/${caseId}/identity`,
          {
            changes: {
              name: { ar: draft.ar, fr: draft.fr },
              birthDate: draft.birthDate,
              address: draft.address,
              phone: draft.phone,
            },
          },
          { method: 'PATCH' },
        )
          .then(() => {
            setEditing(false);
            onSaved();
          })
          .catch(() => setError(true))
          .finally(() => setPending(false));
      }}
    >
      <div className="form-grid">
        {Object.entries(draft).map(([key, value], i) => (
          <Field
            key={key}
            label={
              [
                l('الاسم بالعربية', 'Nom en arabe'),
                l('الاسم بالفرنسية', 'Nom en français'),
                l('تاريخ الولادة', 'Date de naissance'),
                l('العنوان', 'Adresse'),
                l('الهاتف', 'Téléphone'),
              ][i]
            }
          >
            <input
              type={key === 'birthDate' ? 'date' : 'text'}
              required={['ar', 'fr', 'birthDate'].includes(key)}
              value={value}
              onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      {error && (
        <Info tone="orange">
          {l(
            'تعذر الحفظ؛ أعد التحقق من الصلاحيات والبيانات.',
            'Enregistrement refusé ; vérifiez les droits et les données.',
          )}
        </Info>
      )}
      <Button disabled={pending} type="submit">
        {l('حفظ', 'Enregistrer')}
      </Button>{' '}
      <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
        {l('إلغاء', 'Annuler')}
      </Button>
    </form>
  );
}

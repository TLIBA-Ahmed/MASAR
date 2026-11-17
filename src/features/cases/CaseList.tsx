import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownWideNarrow,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderHeart,
  Plus,
  Search,
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { stages } from '../../config/workflow';
import { api } from '../../services/api';
import { normalize } from '../../services/search';
import { CaseTable } from '../../components/tables/CaseTable';
import {
  Badge,
  Button,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  useAction,
} from '../../components/ui';
const empty = {
  ar: '',
  fr: '',
  birthDate: '',
  gender: 'male',
  address: '',
  father: '',
  mother: '',
  source: '',
  familyId: '',
};
export function NewCaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { l, b, t } = useLocale();
  const { data, refresh } = useWorkspace();
  const navigate = useNavigate();
  const run = useAction();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(empty);
  const update = (key: keyof typeof empty, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
  };
  const submit = async () => {
    const result = await run(
      async () => {
        const created = await api<{ id: string }>('/cases', {
          name: { ar: draft.ar, fr: draft.fr || draft.ar },
          birthDate: draft.birthDate,
          gender: draft.gender === 'female' ? 'female' : 'male',
          address: draft.address,
          father: draft.father,
          mother: draft.mother,
          source: draft.source,
          ...(draft.familyId ? { familyId: draft.familyId } : {}),
        });
        await refresh();
        return created;
      },
      l('تم فتح الملف الرقمي بنجاح.', 'Le dossier central a été créé.'),
    );
    if (result) {
      setDraft(empty);
      setStep(0);
      onClose();
      navigate(`/cases/${result.id}`);
    }
  };
  return (
    <Modal
      wide
      open={open}
      onClose={onClose}
      title={l('بداية مسار جديد', 'Le début d’un nouveau parcours')}
      description={l(
        'افتح ملفاً اصطناعياً. ستُستخدم هذه البيانات مرة واحدة في جميع النماذج.',
        'Créez un dossier fictif. Ces informations seront réutilisées dans tous les formulaires.',
      )}
    >
      <div className="wizard-steps">
        {[
          l('هوية الطفل', 'Identité'),
          l('المحيط والإحالة', 'Famille et orientation'),
          l('مراجعة وفتح الملف', 'Vérification'),
        ].map((label, i) => (
          <span key={i} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <i>{i + 1}</i>
            {label}
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) setStep((v) => v + 1);
          else submit();
        }}
      >
        <div className="dialog-body">
          {step === 0 && (
            <div className="form-grid">
              <Field
                label={l('الاسم واللقب بالعربية (اسم اصطناعي)', 'Nom en arabe (fictif)')}
                required
              >
                <input required value={draft.ar} onChange={(e) => update('ar', e.target.value)} />
              </Field>
              <Field label={l('الاسم بالفرنسية', 'Nom en français')}>
                <input value={draft.fr} onChange={(e) => update('fr', e.target.value)} />
              </Field>
              <Field label={l('تاريخ الولادة', 'Date de naissance')} required>
                <input
                  type="date"
                  required
                  max={data.demoDate}
                  value={draft.birthDate}
                  onChange={(e) => update('birthDate', e.target.value)}
                />
              </Field>
              <Field label={l('الجنس', 'Sexe')}>
                <select value={draft.gender} onChange={(e) => update('gender', e.target.value)}>
                  <option value="male">{l('ذكر', 'Masculin')}</option>
                  <option value="female">{l('أنثى', 'Féminin')}</option>
                </select>
              </Field>
              <div className="full-span">
                <Info>
                  {l(
                    'هذا النموذج مخصص للأطفال دون 18 سنة. استخدم بيانات وهمية حصراً.',
                    'Ce prototype concerne les moins de 18 ans. Utilisez exclusivement des données fictives.',
                  )}
                </Info>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="form-grid">
              <Field label={l('عنوان اصطناعي', 'Adresse fictive')}>
                <input value={draft.address} onChange={(e) => update('address', e.target.value)} />
              </Field>
              <Field label={l('مصدر الإحالة', 'Source d’orientation')}>
                <input value={draft.source} onChange={(e) => update('source', e.target.value)} />
              </Field>
              <Field label={l('اسم الأب الاصطناعي', 'Père (fictif)')}>
                <input value={draft.father} onChange={(e) => update('father', e.target.value)} />
              </Field>
              <Field label={l('اسم الأم الاصطناعي', 'Mère (fictif)')}>
                <input value={draft.mother} onChange={(e) => update('mother', e.target.value)} />
              </Field>
              <Field
                label={l('رابط عائلي يؤكده المهني', 'Lien familial confirmé par le professionnel')}
              >
                <select value={draft.familyId} onChange={(e) => update('familyId', e.target.value)}>
                  <option value="">
                    {l('إنشاء أسرة تجريبية جديدة', 'Créer une nouvelle famille fictive')}
                  </option>
                  {data.families
                    .filter((f) =>
                      data.children.some(
                        (ch) =>
                          ch.familyId === f.id &&
                          data.cases.some((c) => c.childId === ch.id && c.centerId === 'siliana'),
                      ),
                    )
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {b(f.label)}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          )}
          {step === 2 && (
            <>
              <div className="review-card">
                <FolderHeart size={32} />
                <h2>{draft.ar}</h2>
                <p>
                  {draft.fr} · {draft.birthDate}
                </p>
                <Badge tone="green">{l('المرحلة 1 — التسجيل', 'Étape 1 — Enregistrement')}</Badge>
              </div>
              <Info tone="green">
                {l(
                  'سيُنشأ ملف مركزي واحد مع سجل فتح وإسناد للفريق التجريبي. لم تُسجّل أي بيانات بعد.',
                  'Un dossier central, un événement d’ouverture et une affectation à l’équipe seront créés. Aucune donnée n’a encore été enregistrée.',
                )}
              </Info>
            </>
          )}
        </div>
        <div className="dialog-footer">
          <span className="muted small">
            {l('مسودة مؤقتة حتى تأكيد التسجيل', 'Brouillon temporaire jusqu’à la confirmation')}
          </span>
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => setStep((v) => v - 1)}>
              {t('back')}
            </Button>
          )}
          <Button type="submit">
            {step === 2 ? l('تأكيد فتح الملف', 'Créer le dossier') : t('next')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function CaseList() {
  const { l, b, t } = useLocale();
  const { data, cases, session } = useWorkspace();
  const run = useAction();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''),
    [sort, setSort] = useState('due'),
    [page, setPage] = useState(0);
  const stage = params.get('stage') ?? '',
    status = params.get('status') ?? '';
  const filtered = cases
    .filter(
      (c) =>
        (!stage || c.stage === Number(stage)) &&
        (!status || c.status === status) &&
        normalize(
          `${c.id} ${JSON.stringify(data.children.find((ch) => ch.id === c.childId)?.name)}`,
        ).includes(normalize(search)),
    )
    .sort((a, bv) =>
      sort === 'due'
        ? a.nextDue.localeCompare(bv.nextDue)
        : sort === 'name'
          ? b(data.children.find((ch) => ch.id === a.childId)!.name).localeCompare(
              b(data.children.find((ch) => ch.id === bv.childId)!.name),
            )
          : bv.id.localeCompare(a.id),
    );
  const change = (key: string, value: string) => {
    setPage(0);
    setParams((prev) => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };
  const pages = Math.max(1, Math.ceil(filtered.length / 8)),
    safePage = Math.min(page, pages - 1);
  const exportCsv = async () => {
    const permitted = await api<{
      cases: { id: string; child_code: string; stage: number; status: string }[];
    }>('/exports/cases', { case_ids: filtered.map((c) => c.id) });
    const text =
      '\ufeff' +
      [
        ['ID', l('الرمز الدائم', 'Code permanent'), l('المرحلة', 'Étape'), l('الحالة', 'Statut')],
        ...permitted.cases.map((c) => [
          c.id,
          c.child_code,
          b(stages[c.stage - 1].title),
          t(c.status),
        ]),
      ]
        .map((row) => row.map((x) => `"${x.replaceAll('"', '""')}"`).join(','))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masar-dossiers-demo.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeading
        eyebrow={l('ملف واحد، رؤية متكاملة', 'UN DOSSIER, UNE VUE COMPLÈTE')}
        title={t('cases')}
        description={l(
          'المعلومة متصلة، منذ أول لقاء وحتى الإدماج.',
          'Une information continue, du premier entretien à l’intégration.',
        )}
        actions={
          <>
            <Button variant="secondary" onClick={() => void run(exportCsv)}>
              <Download size={16} />
              {l('تصدير القائمة', 'Exporter')}
            </Button>
            <Button onClick={() => change('new', '1')} disabled={session?.role !== 'social'}>
              <Plus size={17} />
              {t('newCase')}
            </Button>
          </>
        }
      />
      <div className="list-stat-strip">
        <span>
          <strong>{cases.length}</strong>
          {l('ملفاً في نطاق عملك', 'dossiers dans votre périmètre')}
        </span>
        <span>
          <i className="green-dot" />
          {cases.filter((c) => c.status === 'active').length} {t('active')}
        </span>
        <span>
          {cases.filter((c) => c.stage === 2 && c.status === 'active').length}{' '}
          {l('في فترة الملاحظة', 'en observation')}
        </span>
        <span>
          {cases.filter((c) => c.status === 'closed').length} {t('closed')}
        </span>
      </div>
      <Panel>
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label={l('البحث عن ملف', 'Rechercher un dossier')}
              placeholder={l('رمز الطفل أو رقم الملف…', 'Code enfant ou numéro de dossier…')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label={l('مرحلة المسار', 'Étape')}
            value={stage}
            onChange={(e) => change('stage', e.target.value)}
          >
            <option value="">{l('جميع المراحل', 'Toutes les étapes')}</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {b(s.short)}
              </option>
            ))}
          </select>
          <select
            aria-label={l('الحالة', 'Statut')}
            value={status}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">{l('جميع الحالات', 'Tous les statuts')}</option>
            {['active', 'closed', 'archived'].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
          <label className="sort-select">
            <ArrowDownWideNarrow size={16} />
            <select
              aria-label={l('الترتيب', 'Trier')}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="due">{l('حسب الموعد', 'Par échéance')}</option>
              <option value="name">{l('حسب رمز الطفل', 'Par code enfant')}</option>
              <option value="id">{l('حسب الملف', 'Par dossier')}</option>
            </select>
          </label>
        </div>
        <CaseTable data={data} cases={filtered.slice(safePage * 8, (safePage + 1) * 8)} />
        <div className="pagination">
          <span>
            {filtered.length
              ? `${safePage * 8 + 1}–${Math.min((safePage + 1) * 8, filtered.length)}`
              : '0'}{' '}
            {l('من', 'sur')} {filtered.length} {l('ملف', 'dossiers')}
          </span>
          <div>
            <Button
              variant="secondary"
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronRight size={15} />
              {l('السابق', 'Précédent')}
            </Button>
            <span>
              {safePage + 1} / {pages}
            </span>
            <Button
              variant="secondary"
              disabled={safePage >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
              <ChevronLeft size={15} />
            </Button>
          </div>
        </div>
      </Panel>
      <NewCaseModal open={params.get('new') === '1'} onClose={() => change('new', '')} />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  History,
  Plus,
  Printer,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { forms, getForm } from '../../data/form-definitions';
import type { FormDefinition, FormSubmission, FormValues } from '../../types';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
  prefillForm,
  validateForm,
  formCompleteness,
  protectedIdentityFields,
} from '../../services/forms';
import { saveSubmission } from '../../services/actions';
import { stages } from '../../config/workflow';
import {
  Badge,
  Button,
  Empty,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  SectionHeading,
  useAction,
} from '../../components/ui';
import { DynamicField } from '../../components/forms/DynamicField';
import { normalize } from '../../services/search';
import { accessPolicyService } from '../../services/accessPolicy';
import { RecommendationLink } from '../../components/recommendations/RecommendationLink';
import { DocumentUpload } from './DocumentUpload';
import { api } from '../../services/api';
export function Documents({ filter }: { filter?: 'interviews' | 'assessments' | 'projects' }) {
  const { l, b, t } = useLocale();
  const { data, cases, session } = useWorkspace();
  const [params] = useSearchParams();
  const [caseId, setCaseId] = useState(
      params.get('case') ??
        (cases.some((c) => c.id === 'CDIS-024') ? 'CDIS-024' : (cases[0]?.id ?? '')),
    ),
    [query, setQuery] = useState(''),
    [stage, setStage] = useState('');
  const visible = forms.filter(
    (f) =>
      accessPolicyService.canRead(
        data,
        session,
        accessPolicyService.formResource(f.id, caseId, 'form'),
      ) &&
      (!stage || f.stages.includes(Number(stage) as 1)) &&
      (!filter ||
        (filter === 'interviews'
          ? f.id === 'F01'
          : filter === 'assessments'
            ? ['F02', 'F08', 'F09', 'F12', 'F17', 'F18', 'F19', 'F22'].includes(f.id)
            : ['F13', 'F14', 'F16', 'F20', 'F21'].includes(f.id))) &&
      normalize(`${f.id} ${b(f.title)}`).includes(normalize(query)),
  );
  return (
    <>
      <PageHeading
        eyebrow={l('مصدر واحد للمعلومة', 'UNE SEULE SOURCE D’INFORMATION')}
        title={t(filter ?? 'documents')}
        description={l(
          `${forms.length} نموذجاً مهنياً. بيانات تُكتب مرة واحدة، ووثائق تحفظ تاريخها.`,
          `${forms.length} modèles métier. Une saisie unique et des documents qui conservent leur histoire.`,
        )}
        actions={
          filter === 'projects' && (
            <RecommendationLink
              contexts={[
                'educational-project',
                'training-project',
                'professional-resources',
                'social-intervention',
                'administrative-followup',
              ]}
              caseId={caseId}
            >
              <Sparkles size={16} />
              {t('recommendations')}
            </RecommendationLink>
          )
        }
      />
      <Panel className="document-controls">
        <Field label={l('الملف المعني', 'Dossier concerné')}>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            {cases.map((c) => (
              <option value={c.id} key={c.id}>
                {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
              </option>
            ))}
          </select>
        </Field>
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label={l('البحث عن نموذج', 'Rechercher un modèle')}
            placeholder={l('اسم النموذج أو رمزه…', 'Nom ou code du formulaire…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label={l('المرحلة', 'Étape')}
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">{l('جميع المراحل', 'Toutes les étapes')}</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {b(s.short)}
            </option>
          ))}
        </select>
      </Panel>
      <Info>
        <DocumentUpload key={caseId} caseId={caseId} />
        {l(
          'النماذج منسوخة من المراجع المتاحة. العبارات غير المؤكدة موثقة للمراجعة. المصادقة الإلكترونية محاكاة وليست توقيعاً رسمياً.',
          'Modèles transcrits depuis les références disponibles ; les libellés incertains restent à valider. Les validations sont simulées, sans signature officielle.',
        )}
      </Info>
      <div className="document-grid">
        {visible.map((f) => {
          const docs = data.submissions.filter((s) => s.caseId === caseId && s.formId === f.id);
          const last = docs.toSorted((a, b) => b.version - a.version)[0];
          return (
            <Link to={`/documents/${caseId}/${f.id}`} key={f.id} className="panel document-card">
              <div className="document-card-top">
                <span className="document-code">{f.id}</span>
                <Badge tone={last?.status === 'validated' ? 'green' : last ? 'orange' : 'neutral'}>
                  {t(last?.status ?? 'notStarted')}
                </Badge>
              </div>
              <FileText size={29} />
              <h2>{b(f.title)}</h2>
              <p>
                {f.sections.length} {l('أقسام', 'sections')} · {t(f.role)}
              </p>
              <div className="document-card-bottom">
                <span>{f.stages.map((id) => `${l('مرحلة', 'Étape')} ${id}`).join(' · ')}</span>
                <span>{last ? `v${last.version}` : l('فتح النموذج', 'Ouvrir')}</span>
              </div>
            </Link>
          );
        })}
      </div>
      {!visible.length && <Empty title={t('noResults')} />}
    </>
  );
}
export function FormPage() {
  const { caseId, formId } = useParams();
  const { cases, data, session } = useWorkspace();
  const { t, l } = useLocale();
  const [params] = useSearchParams();
  const form = getForm(formId ?? '');
  if (
    !form ||
    !cases.some((c) => c.id === caseId) ||
    !accessPolicyService.canRead(data, session, accessPolicyService.formResource(form.id, caseId))
  )
    return (
      <Empty
        title={t('noResults')}
        description={l(
          'تحقق من رقم الملف ونطاق جلستك.',
          'Vérifiez le numéro de dossier et votre périmètre.',
        )}
      />
    );
  return (
    <FormEditor key={`${caseId}-${formId}-${params.toString()}`} caseId={caseId!} form={form} />
  );
}
function FormEditor({ caseId, form }: { caseId: string; form: FormDefinition }) {
  const { l, b, t, lang, date } = useLocale();
  const { data, cases, mutate } = useWorkspace();
  const c = cases.find((c) => c.id === caseId)!;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const versions = data.submissions
    .filter((s) => s.caseId === caseId && s.formId === form.id)
    .toSorted((a, b) => b.version - a.version);
  const selected =
    versions.find((s) => s.id === params.get('version')) ??
    (params.get('new') === '1'
      ? undefined
      : (versions.find((s) => s.status === 'draft') ?? versions[0]));
  const readonly = Boolean(selected && selected.status !== 'draft');
  const [values, setValues] = useState<FormValues>(() =>
      structuredClone(selected?.values ?? prefillForm(form, data, c, lang)),
    ),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [dirty, setDirty] = useState(false),
    [print, setPrint] = useState(false),
    [confirm, setConfirm] = useState(false),
    [activeSection, setActiveSection] = useState(form.sections[0].id);
  const run = useAction();
  useEffect(() => {
    if (!dirty || readonly) return;
    const timer = window.setTimeout(() => {
      try {
        void mutate((d, s) => saveSubmission(d, s, caseId, form, values, 'draft', lang)).catch(
          () => undefined,
        );
      } catch {
        /* Manual save reports errors through the action wrapper. */
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [values, dirty, readonly, mutate, caseId, form, lang]);
  const save = async (status: FormSubmission['status']) => {
    const errs = validateForm(form, values, data.demoDate);
    setErrors(errs);
    if (status !== 'draft' && Object.keys(errs).length) {
      const first = form.sections.find((s) => s.fields.some((f) => errs[f.key]));
      if (first) setActiveSection(first.id);
      return;
    }
    const id = await run(
      () => mutate((d, s) => saveSubmission(d, s, caseId, form, values, status, lang)),
      status === 'validated'
        ? l(
            'حُفظت نسخة مصادق عليها تجريبياً.',
            'La version validée de manière simulée est conservée.',
          )
        : t('saved'),
    );
    if (id) {
      setDirty(false);
      setConfirm(false);
      if (status !== 'draft') navigate(`?version=${id}`, { replace: true });
    }
  };
  const section = form.sections.find((s) => s.id === activeSection)!;
  const completion = formCompleteness(form, values);
  return (
    <>
      <PageHeading
        eyebrow={`${caseId} / ${form.id}`}
        title={b(form.title)}
        description={l(
          'سجل مهني قابل للتتبع، مرتبط مباشرة بالملف المركزي.',
          'Un document traçable, directement relié au dossier central.',
        )}
        actions={
          <>
            <Link className="button secondary" to={`/cases/${caseId}?tab=documents`}>
              {lang === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />} {t('back')}
            </Link>
            <Button variant="secondary" onClick={() => setPrint(true)}>
              <Printer size={16} />
              {t('print')}
            </Button>
          </>
        }
      />
      <div className="form-meta-strip">
        <Badge tone={readonly ? 'green' : 'orange'}>
          {t(readonly ? selected!.status : 'draft')}
        </Badge>
        <span>
          {l('إصدار', 'Version')}{' '}
          {selected?.version ?? Math.max(0, ...versions.map((s) => s.version)) + 1}
        </span>
        <span>
          {l('المؤلف', 'Auteur')} :{' '}
          {selected
            ? b(data.professionals.find((p) => p.id === selected.authorId)!.name)
            : t(form.role)}
        </span>
        {selected && <span>{date(selected.date)}</span>}
        <label className="version-selector">
          <History size={15} />
          <select
            aria-label={l('نسخ الوثيقة', 'Versions du document')}
            value={selected?.id ?? 'new'}
            onChange={(e) =>
              navigate(e.target.value === 'new' ? '?new=1' : `?version=${e.target.value}`)
            }
          >
            <option value="new">
              {l('نسخة جديدة من البيانات الحالية', 'Nouvelle version depuis les données actuelles')}
            </option>
            {versions.map((v) => (
              <option value={v.id} key={v.id}>
                v{v.version} · {t(v.status)} · {date(v.date)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {readonly ? (
        <Info tone="green">
          {l(
            'هذه نسخة تاريخية محفوظة. تعديل بيانات الطفل الحالية لا يغيرها. أنشئ نسخة جديدة للتحديث.',
            'Cette version historique est conservée. Les modifications du profil actuel ne la changent pas. Créez une nouvelle version pour l’actualiser.',
          )}
          <Button variant="secondary" onClick={() => navigate('?new=1')}>
            <Plus size={15} />
            {l('نسخة جديدة', 'Nouvelle version')}
          </Button>
        </Info>
      ) : (
        <Info>
          {l(
            'الحقول المتاحة معبأة من الملف المركزي. التغييرات في الهوية تُطبق عند الإتمام أو المصادقة فقط. المسودات تحفظ تلقائياً.',
            'Les champs disponibles sont préremplis depuis le dossier. Les changements d’identité s’appliquent à la complétion ou à la validation. Le brouillon est sauvegardé automatiquement.',
          )}
        </Info>
      )}
      <div className="form-layout">
        <aside className="panel form-section-nav">
          <div className="form-progress">
            <strong>{l('اكتمال البيانات', 'Complétude')}</strong>
            <span>{completion}%</span>
            <div>
              <i style={{ width: `${completion}%` }} />
            </div>
            <small>
              {l('مؤشر تعبئة، وليس نتيجة تقييم', 'Indicateur de saisie, sans score d’évaluation')}
            </small>
          </div>
          {form.sections.map((s, i) => (
            <button
              key={s.id}
              className={activeSection === s.id ? 'active' : ''}
              onClick={() => setActiveSection(s.id)}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {b(s.title)}
              {s.fields.some((f) => errors[f.key]) && <i className="error-marker" />}
            </button>
          ))}
        </aside>
        <Panel className="form-content">
          <SectionHeading
            title={b(section.title)}
            subtitle={`${form.id} · ${form.sections.findIndex((s) => s.id === section.id) + 1} / ${form.sections.length}`}
          />
          {section.note && <Info tone="orange">{b(section.note)}</Info>}
          <div className="form-grid">
            {section.fields
              .filter((f) => !f.condition || values[f.condition.field] === f.condition.value)
              .map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  disabled={
                    readonly ||
                    c.status !== 'active' ||
                    Boolean(
                      data.backend && field.shared && protectedIdentityFields.has(field.shared),
                    )
                  }
                  error={errors[field.key]}
                  onChange={(value) => {
                    setValues((prev) => ({ ...prev, [field.key]: value }));
                    setDirty(true);
                  }}
                />
              ))}
          </div>
          <div className="form-page-navigation">
            <Button
              variant="secondary"
              disabled={activeSection === form.sections[0].id}
              onClick={() =>
                setActiveSection(
                  form.sections[form.sections.findIndex((s) => s.id === activeSection) - 1].id,
                )
              }
            >
              {t('back')}
            </Button>
            <Button
              variant="secondary"
              disabled={activeSection === form.sections.at(-1)!.id}
              onClick={() =>
                setActiveSection(
                  form.sections[form.sections.findIndex((s) => s.id === activeSection) + 1].id,
                )
              }
            >
              {t('next')}
            </Button>
          </div>
        </Panel>
      </div>
      {!readonly && c.status === 'active' && (
        <div className="sticky-form-actions">
          <span>
            <span className="live-dot" />
            {dirty
              ? l('حفظ تلقائي للمسودة', 'Sauvegarde automatique du brouillon')
              : l('الوثيقة جاهزة للتحرير', 'Document prêt à être modifié')}
          </span>
          <div>
            <Button variant="secondary" onClick={() => save('draft')}>
              <Save size={16} />
              {l('حفظ المسودة', 'Enregistrer le brouillon')}
            </Button>
            <Button variant="secondary" onClick={() => save('completed')}>
              <Check size={16} />
              {l('إتمام', 'Terminer')}
            </Button>
            <Button onClick={() => setConfirm(true)}>
              <ShieldCheck size={16} />
              {l('مصادقة تجريبية', 'Valider (simulation)')}
            </Button>
          </div>
        </div>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={l('مصادقة مهنية تجريبية', 'Validation professionnelle simulée')}
        description={l(
          'ستُحفظ هذه النسخة وتُحدّث البيانات المشتركة. هذه ليست توقيعاً رسمياً.',
          'Cette version sera conservée et les données partagées actualisées. Il ne s’agit pas d’une signature officielle.',
        )}
      >
        <div className="dialog-body">
          <Info tone="orange">
            {l(
              'تأكد من مراجعة الملاحظات والمعطيات قبل حفظ النسخة.',
              'Vérifiez les observations et informations avant de conserver cette version.',
            )}
          </Info>
        </div>
        <div className="dialog-footer">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={() => save('validated')}>
            {l('تأكيد المصادقة التجريبية', 'Confirmer la validation simulée')}
          </Button>
        </div>
      </Modal>
      <Modal
        wide
        open={print}
        onClose={() => setPrint(false)}
        title={l('معاينة الوثيقة', 'Aperçu du document')}
        description={l(
          'اختر «حفظ بصيغة PDF» في نافذة الطباعة لتصدير الوثيقة.',
          'Choisissez « Enregistrer au format PDF » dans la boîte de dialogue d’impression pour exporter.',
        )}
      >
        <div className="print-preview-scroll">
          <article className="print-document">
            <div className="print-letterhead">
              <img src="/masar.svg" alt="MASAR" />
              <div>
                <strong>
                  {l(
                    'مسار — مركز الدفاع والإدماج الاجتماعي',
                    'MASAR — Centre de défense et d’intégration sociale',
                  )}
                </strong>
                <p>{b(data.centers.find((center) => center.id === c.centerId)!.name)}</p>
              </div>
              <span>
                {form.id}
                <br />
                {caseId}
              </span>
            </div>
            <div className="print-watermark">
              {t('demo')} · {t('synthetic')}
            </div>
            <h1>{b(form.title)}</h1>
            <div className="print-meta">
              {l('إصدار', 'Version')} {selected?.version ?? '—'} ·{' '}
              {selected ? date(selected.date) : date(data.demoDate)} ·{' '}
              {t(selected?.status ?? 'draft')}
            </div>
            {form.sections.map((s) => (
              <section className="print-section" key={s.id}>
                <h2>{b(s.title)}</h2>
                {s.note && <p>{b(s.note)}</p>}
                <div className="print-fields">
                  {s.fields
                    .filter((f) => !f.condition || values[f.condition.field] === f.condition.value)
                    .map((f) => (
                      <div
                        className={`print-field ${f.type === 'table' || f.type === 'matrix' || f.type === 'textarea' ? 'full-span' : ''}`}
                        key={f.key}
                      >
                        {f.type === 'table' || f.type === 'matrix' ? (
                          <DynamicField
                            field={f}
                            value={values[f.key]}
                            disabled
                            onChange={() => {}}
                          />
                        ) : (
                          <>
                            <strong>{b(f.label)}</strong>
                            <p>{formatPrintValue(f, values[f.key], b, l)}</p>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            ))}
            <footer>
              {l(
                'وثيقة تجريبية ببيانات اصطناعية — لا تُستعمل كوثيقة رسمية أو توقيع معتمد.',
                'Document de démonstration à données synthétiques — sans valeur officielle ni signature certifiée.',
              )}
            </footer>
          </article>
        </div>
        <div className="dialog-footer">
          <Button variant="secondary" onClick={() => setPrint(false)}>
            {t('close')}
          </Button>
          <Button
            onClick={() =>
              void run(async () => {
                await api(
                  `/cases/${caseId}/forms/${form.id}/access${selected ? `?version_id=${encodeURIComponent(selected.id)}` : ''}`,
                );
                window.print();
              })
            }
          >
            <Printer size={17} />
            {l('طباعة / حفظ PDF', 'Imprimer / Enregistrer en PDF')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
function formatPrintValue(
  field: FormDefinition['sections'][number]['fields'][number],
  value: FormValues[string] | undefined,
  b: (v: { ar: string; fr: string }) => string,
  l: (a: string, f: string) => string,
): string {
  if (value === undefined || value === '') return '—';
  if (field.options) {
    if (Array.isArray(value))
      return value
        .map((v) =>
          b(field.options!.find((o) => o.value === v)?.label ?? { ar: String(v), fr: String(v) }),
        )
        .join('، ');
    return b(
      field.options.find((o) => o.value === value)?.label ?? {
        ar: String(value),
        fr: String(value),
      },
    );
  }
  if (typeof value === 'boolean') return value ? l('نعم', 'Oui') : l('لا', 'Non');
  return String(value);
}

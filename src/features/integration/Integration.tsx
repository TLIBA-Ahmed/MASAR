import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RecommendationLink } from '../../components/recommendations/RecommendationLink';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import type { IntegrationRecord } from '../../types';
import { recordEvent } from '../../services/actions';
import { requireCase } from '../../services/auth';
import { uid } from '../../utils/date';
import {
  Badge,
  Button,
  Empty,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  useAction,
} from '../../components/ui';
export function IntegrationPanel({ caseId }: { caseId?: string }) {
  const { l, b, t, date } = useLocale();
  const { data, cases, mutate } = useWorkspace();
  const ids = new Set(cases.map((c) => c.id));
  const records = data.integrations.filter(
    (i) => ids.has(i.caseId) && (!caseId || i.caseId === caseId),
  );
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<IntegrationRecord | null>(null);
  const [draft, setDraft] = useState({
    caseId: caseId ?? 'CDIS-024',
    partner: '',
    type: 'school',
    date: data.demoDate,
    objectives: '',
    notes: '',
    status: 'proposed',
    result: '',
    followUpDate: data.demoDate,
  });
  const run = useAction();
  const update = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const edit = (record?: IntegrationRecord) => {
    setSelected(record ?? null);
    setDraft(
      record
        ? { ...record }
        : {
            caseId: caseId ?? cases[0]?.id ?? '',
            partner: '',
            type: 'school',
            date: data.demoDate,
            objectives: '',
            notes: '',
            status: 'proposed',
            result: '',
            followUpDate: data.demoDate,
          },
    );
    setOpen(true);
  };
  const save = () => {
    const result = run(() =>
      mutate((d, s) => {
        const c = requireCase(d, s, draft.caseId);
        if (c.status !== 'active') throw Error('INACTIVE');
        if (!draft.partner.trim() || !draft.objectives.trim()) throw Error('VALIDATION');
        const record: IntegrationRecord = {
          ...draft,
          type: draft.type as IntegrationRecord['type'],
          status: draft.status as IntegrationRecord['status'],
          id: selected?.id ?? uid('integration'),
          professionalId: s.professionalId,
        };
        d.integrations = d.integrations.filter((i) => i.id !== record.id);
        d.integrations.push(record);
        recordEvent(
          d,
          c,
          s,
          'integration',
          l('توثيق توجيه ومتابعة الإدماج', 'Orientation et suivi documentés')
            ? { ar: 'توثيق التوجيه ومتابعة الإدماج', fr: 'Orientation et suivi documentés' }
            : { ar: '', fr: '' },
          `${draft.partner} — ${draft.objectives}\n${draft.result}`,
          record.id,
        );
        if (record.followUpDate && !d.appointments.some((a) => a.id === `follow-${record.id}`))
          d.appointments.push({
            id: `follow-${record.id}`,
            caseId: c.id,
            title: { ar: 'متابعة بعد الإدماج', fr: 'Suivi après intégration' },
            date: record.followUpDate,
            time: '10:00',
            type: 'followUp',
            professionalId: s.professionalId,
            completed: false,
            notes: record.partner,
          });
        else
          d.appointments = d.appointments.map((a) =>
            a.id === `follow-${record.id}` ? { ...a, date: record.followUpDate } : a,
          );
        return true;
      }),
    );
    if (result) setOpen(false);
  };
  return (
    <>
      <div className="inline-actions">
        <Info tone="blue">
          {l(
            'التوجيه قرار مهني موثق. لا يؤدي إلى ختم الملف تلقائياً. أسماء الشركاء تجريبية.',
            'L’orientation est une décision professionnelle documentée. Elle ne clôture jamais le dossier automatiquement. Partenaires fictifs.',
          )}
        </Info>
        <Button onClick={() => edit()}>
          <Plus size={16} />
          {l('توثيق توجيه', 'Documenter une orientation')}
        </Button>
      </div>
      {records.length ? (
        <div className="integration-grid">
          {records.map((r) => (
            <Panel className="integration-card" key={r.id}>
              <div className="card-topline">
                <span className="soft-icon">
                  <ArrowUpRight size={20} />
                </span>
                <Badge tone={r.status === 'completed' ? 'green' : 'blue'}>{t(r.status)}</Badge>
              </div>
              <h2>{r.partner}</h2>
              <p>
                {t(r.type)} · {date(r.date)}
              </p>
              <p className="narrative">{r.objectives}</p>
              {r.result && <blockquote>{r.result}</blockquote>}
              <div className="card-footer">
                <Link to={`/cases/${r.caseId}`}>{r.caseId}</Link>
                <Button variant="secondary" onClick={() => edit(r)}>
                  {l('متابعة وتحديث', 'Suivre et modifier')}
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          title={l('لم يوثّق أي توجيه بعد', 'Aucune orientation documentée')}
          description={l(
            'يسجل المهني الوجهة والأهداف ونتائج المتابعة عند الحاجة.',
            'Le professionnel documente la structure, les objectifs et les résultats du suivi.',
          )}
        />
      )}
      <Modal
        wide
        open={open}
        onClose={() => setOpen(false)}
        title={l('التوجيه ومتابعة الإدماج', 'Orientation et suivi d’intégration')}
        description={l(
          'وثّق القرار البشري ونتائجه دون إنهاء مسار المتابعة.',
          'Documentez la décision humaine et ses résultats tout en conservant le suivi.',
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="dialog-body form-grid">
            <Field label={t('cases')}>
              <select
                value={draft.caseId}
                disabled={Boolean(caseId) || Boolean(selected)}
                onChange={(e) => update('caseId', e.target.value)}
              >
                {cases
                  .filter((c) => c.status === 'active' || c.id === draft.caseId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={l('الشريك التجريبي', 'Partenaire fictif')} required>
              <input
                value={draft.partner}
                required
                onChange={(e) => update('partner', e.target.value)}
              />
            </Field>
            <Field label={l('نوع التوجيه', 'Type d’orientation')}>
              <select value={draft.type} onChange={(e) => update('type', e.target.value)}>
                {['school', 'family', 'training', 'secondChance', 'other'].map((type) => (
                  <option key={type} value={type}>
                    {t(type)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l('التاريخ', 'Date')}>
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </Field>
            <div className="full-span">
              <Field label={l('الأهداف', 'Objectifs')} required>
                <textarea
                  required
                  value={draft.objectives}
                  onChange={(e) => update('objectives', e.target.value)}
                />
              </Field>
            </div>
            <Field label={l('حالة التوجيه', 'Statut')}>
              <select value={draft.status} onChange={(e) => update('status', e.target.value)}>
                {['proposed', 'confirmed', 'followUp', 'completed'].map((status) => (
                  <option key={status} value={status}>
                    {t(status)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l('موعد المتابعة', 'Date de suivi')}>
              <input
                type="date"
                value={draft.followUpDate}
                onChange={(e) => update('followUpDate', e.target.value)}
              />
            </Field>
            <div className="full-span">
              <Field label={l('النتائج الموثقة', 'Résultats documentés')}>
                <textarea value={draft.result} onChange={(e) => update('result', e.target.value)} />
              </Field>
              <Field label={l('ملاحظات مهنية', 'Observations')}>
                <textarea value={draft.notes} onChange={(e) => update('notes', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function Integration() {
  const { t, l, b } = useLocale();
  const { data } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const partner = data.partners.find((p) => p.id === params.get('partner'));
  return (
    <>
      <PageHeading
        title={t('integration')}
        description={l(
          'نتائج قابلة للمتابعة، وشراكات موثقة بقرار مهني.',
          'Des résultats suivis et des orientations documentées par les professionnels.',
        )}
        actions={
          <RecommendationLink contexts={['orientation-integration']}>
            {t('recommendations')}
          </RecommendationLink>
        }
      />
      <IntegrationPanel />
      <Panel className="professional-resource-panel">
        <div className="section-heading">
          <h2>{l('الهياكل الشريكة التجريبية', 'Structures partenaires fictives')}</h2>
        </div>
        <div className="resource-card-grid">
          {data.partners.map((p) => (
            <button
              key={p.id}
              className="resource-card"
              onClick={() => setParams({ partner: p.id })}
            >
              <strong>{b(p.name)}</strong>
              <p>{b(p.description)}</p>
            </button>
          ))}
        </div>
      </Panel>
      <Modal
        open={Boolean(partner)}
        onClose={() => setParams({})}
        title={partner ? b(partner.name) : ''}
        description={l(
          'هيكل اصطناعي للعرض فقط، دون اتصال خارجي.',
          'Structure synthétique de démonstration, sans prise de contact externe.',
        )}
      >
        {partner && (
          <div className="dialog-body">
            <p>{b(partner.description)}</p>
            <ul>
              {partner.services.map((service, i) => (
                <li key={i}>{b(service)}</li>
              ))}
            </ul>
            <RecommendationLink contexts={['orientation-integration']}>
              {t('recommendations')}
            </RecommendationLink>
          </div>
        )}
      </Modal>
    </>
  );
}

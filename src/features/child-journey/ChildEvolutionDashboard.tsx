import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock3, FileCheck2, Target, Users } from 'lucide-react';
import { useLocale } from '../../i18n';
import { Badge, Empty, Panel, SectionHeading } from '../../components/ui';
import { phaseLabels } from './labels';
import { AuthorizedJourneyDocumentLink } from './AuthorizedJourneyDocumentLink';
import type { ChildJourney } from './types';

export function ChildEvolutionDashboard({ journey: j }: { journey: ChildJourney }) {
  const { l, b, date } = useLocale();
  const [form, setForm] = useState('all');
  const m = j.metrics;
  const indicators = [
    [
      l('مدة المرافقة', 'Durée d’accompagnement'),
      m.days,
      l('يوماً منذ فتح الملف', 'jours depuis l’ouverture'),
      CalendarDays,
    ],
    [
      l('المحادثات الموثقة', 'Entretiens documentés'),
      m.interviews,
      l('ضمن نطاق الوصول', 'dans le périmètre d’accès'),
      Users,
    ],
    [
      l('التدخلات الموثقة', 'Interventions documentées'),
      m.interventions,
      l('المبرمجة أو المسجلة في التاريخ', 'planifiées ou inscrites à l’historique'),
      Target,
    ],
    [
      l('التقييمات المتاحة', 'Évaluations disponibles'),
      m.assessments,
      l('نسخ متعاقبة محفوظة', 'versions successives conservées'),
      FileCheck2,
    ],
    [
      l('الأنشطة المبرمجة', 'Activités programmées'),
      m.scheduledActivities,
      l('لم تُسجل كمنجزة بعد', 'non encore enregistrées comme réalisées'),
      Clock3,
    ],
    [
      l('الأنشطة المنجزة', 'Activités réalisées'),
      m.completedActivities,
      l('موثقة في الجلسات', 'documentées dans les séances'),
      CheckCircle2,
    ],
    [
      l('الحضور', 'Présences'),
      m.present,
      l('جلسات منجزة فقط', 'séances réalisées uniquement'),
      CheckCircle2,
    ],
    [
      l('الغياب', 'Absences'),
      m.absent,
      l('غياب مسجل صراحة', 'absences explicitement enregistrées'),
      CalendarDays,
    ],
    [
      l('أهداف المشروع', 'Objectifs du projet'),
      m.goalsTotal,
      l('أهداف ظاهرة في الخطة', 'objectifs visibles du plan'),
      Target,
    ],
    [
      l('الأهداف المؤكدة', 'Objectifs confirmés'),
      m.goalsConfirmed,
      l('تأكيد من قبل مهني', 'confirmés par un professionnel'),
      CheckCircle2,
    ],
    [
      l('الأهداف المتحققة', 'Objectifs atteints'),
      m.goalsAchieved,
      l('حسب توثيق المهنيين', 'selon le constat des professionnels'),
      Target,
    ],
    [
      l('الأهداف قيد الإنجاز', 'Objectifs en cours'),
      m.goalsInProgress,
      l('حالة مسجلة صراحة', 'statut explicitement enregistré'),
      Clock3,
    ],
  ] as const;
  const comparisons = j.comparisons.filter((c) => form === 'all' || c.formId === form);
  return (
    <section
      className="child-evolution-dashboard"
      aria-label={l('التطور الموثق للطفل', 'Évolution documentée de l’enfant')}
    >
      <SectionHeading
        title={l('التطور الموثق، خطوة بخطوة', 'L’évolution documentée, pas à pas')}
        subtitle={l(
          'مؤشرات من الملف المصرح به؛ لا تقييم آلي للطفل.',
          'Des indicateurs issus du dossier autorisé ; aucune évaluation automatique de l’enfant.',
        )}
      />
      <div className="journey-indicators">
        {indicators.map(([label, value, caption, Icon]) => (
          <article key={label}>
            <Icon size={18} />
            <span>{label}</span>
            <strong>{value === null ? '—' : value}</strong>
            <small>{value === null ? l('غير موثق', 'Non documenté') : caption}</small>
          </article>
        ))}
      </div>
      <div className="journey-support-grid">
        <Panel>
          <SectionHeading
            title={l('الأهداف والمهارات', 'Objectifs et compétences')}
            actions={<Target size={19} />}
          />
          {j.goals.length ? (
            <ul className="journey-goals">
              {j.goals.map((g) => (
                <li key={g.id}>
                  <span className={g.confirmed ? 'confirmed' : ''}>
                    <CheckCircle2 size={17} />
                  </span>
                  <div>
                    <strong>{b(g.description)}</strong>
                    <small>
                      {g.confirmed
                        ? l('هدف مؤكد مهنياً', 'Objectif confirmé professionnellement')
                        : l('ينتظر التأكيد', 'En attente de confirmation')}
                      {g.dueDate ? ` · ${date(g.dueDate)}` : ''}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title={l(
                'لا أهداف متاحة ضمن هذا النطاق',
                'Aucun objectif disponible dans ce périmètre',
              )}
            />
          )}
        </Panel>
        <Panel>
          <SectionHeading
            title={l('الإجراءات والمواعيد المسجلة', 'Actions et échéances enregistrées')}
            actions={<CalendarDays size={19} />}
          />
          {j.deadlines.length ? (
            <ul className="journey-deadlines">
              {j.deadlines.slice(0, 8).map((d) => (
                <li key={d.id}>
                  <time>{date(d.date)}</time>
                  <Link to={d.path}>{b(d.title)}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {l(
                'لا إجراءات مبرمجة متاحة. راجع أجل الملف في الأعلى.',
                'Aucune action programmée disponible. L’échéance du dossier figure en haut de page.',
              )}
            </p>
          )}
        </Panel>
      </div>
      <Panel className="journey-assessment-comparison">
        <SectionHeading
          title={l('مقارنة التقييمات الموثقة', 'Comparer les évaluations documentées')}
          subtitle={l(
            'الملاحظات والمقاييس الأصلية محفوظة؛ لا نتيجة إجمالية أو مقارنة لمقاييس غير متكافئة.',
            'Les observations et échelles d’origine sont conservées ; aucun score global ni comparaison d’échelles incompatibles.',
          )}
          actions={
            <select
              aria-label={l('استمارة المقارنة', 'Formulaire de comparaison')}
              value={form}
              onChange={(e) => setForm(e.target.value)}
            >
              <option value="all">
                {l('كل الاستمارات المتاحة', 'Tous les formulaires disponibles')}
              </option>
              {[...new Set(j.comparisons.map((c) => c.formId))].map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          }
        />
        {comparisons.length ? (
          <div className="journey-comparison-grid">
            {comparisons.map((c) => (
              <article key={c.id}>
                <header>
                  <Badge tone="blue">
                    {c.formId} · v{c.version}
                  </Badge>
                  <time>{date(c.date)}</time>
                </header>
                <h3>
                  {c.phase
                    ? b(phaseLabels[c.phase])
                    : l('نسخة تقييم موثقة', 'Version d’évaluation documentée')}
                </h3>
                <small>{b(c.title)}</small>
                {c.fields.map((field, i) => (
                  <div key={i}>
                    <h4>{b(field.label)}</h4>
                    <p className="narrative">{field.value}</p>
                  </div>
                ))}
                <AuthorizedJourneyDocumentLink caseId={j.caseId} versionId={c.id} path={c.path}>
                  {l('فتح الاستمارة الأصلية', 'Ouvrir le formulaire original')}
                </AuthorizedJourneyDocumentLink>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={l(
              'لا تقييمات متاحة للمقارنة ضمن هذا النطاق',
              'Aucune évaluation à comparer dans ce périmètre',
            )}
          />
        )}
      </Panel>
    </section>
  );
}

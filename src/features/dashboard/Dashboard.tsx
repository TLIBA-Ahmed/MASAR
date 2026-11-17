import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Compass,
  FileClock,
  FolderHeart,
  HeartHandshake,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { stages } from '../../config/workflow';
import { Badge, PageHeading, Panel, SectionHeading } from '../../components/ui';
import { CaseTable } from '../../components/tables/CaseTable';
import { brand } from '../../config/brand';
export function Dashboard() {
  const { l, b, t, date, lang, number } = useLocale();
  const { data, cases, session } = useWorkspace();
  const p = data.professionals.find((p) => p.id === session?.professionalId)!;
  const active = cases.filter((c) => c.status === 'active'),
    ids = new Set(cases.map((c) => c.id));
  const evaluations = data.appointments.filter(
    (a) => a.type === 'evaluation' && !a.completed && a.caseId && ids.has(a.caseId),
  );
  const integrations = data.integrations.filter((i) => ids.has(i.caseId));
  const sessions = data.sessions.filter((s) => s.participants.every((p) => ids.has(p.caseId)));
  const completed = sessions.filter((s) => s.status === 'completed');
  const present = completed
      .flatMap((s) => s.participants)
      .filter((p) => ids.has(p.caseId) && p.attendance === 'present').length,
    absent = completed
      .flatMap((s) => s.participants)
      .filter((p) => ids.has(p.caseId) && p.attendance !== 'present').length;
  const due = active
    .filter((c) => c.nextDue <= data.demoDate)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const upcoming = [
    ...data.appointments
      .filter((a) => a.caseId && ids.has(a.caseId) && !a.completed)
      .map((a) => ({
        id: a.id,
        title: a.title,
        date: a.date,
        time: a.time,
        caseId: a.caseId,
        type: a.type,
      })),
    ...sessions
      .filter((s) => s.status === 'planned')
      .map((s) => ({
        id: s.id,
        title: data.activities.find((a) => a.id === s.activityId)!.title,
        date: s.date,
        time: s.time,
        caseId: s.participants[0].caseId,
        type: 'activity',
      })),
  ]
    .filter((a) => a.date >= data.demoDate)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 3);
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${data.demoDate}T12:00:00`);
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      name: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', { month: 'short' }).format(
        d,
      ),
      registrations: cases.filter((c) => c.openedAt.startsWith(month)).length,
      activities: completed.filter((s) => s.date.startsWith(month)).length,
    };
  });
  const kpis = [
    {
      title: l('الأطفال المتعهد بهم', 'Enfants accompagnés'),
      value: cases.length,
      caption: l('ضمن نطاق مساحة العمل', 'Dans le périmètre de travail'),
      Icon: Users,
      color: 'teal',
    },
    {
      title: l('الملفات النشطة', 'Dossiers actifs'),
      value: active.length,
      caption: l('مسارات متابعة متواصلة', 'Parcours en cours de suivi'),
      Icon: FolderHeart,
      color: 'blue',
    },
    {
      title: l('التقييمات القادمة', 'Évaluations à venir'),
      value: evaluations.length,
      caption: l('تحتاج إلى متابعة الفريق', 'À préparer avec l’équipe'),
      Icon: FileClock,
      color: 'gold',
    },
    {
      title: l('مسارات الإدماج', 'Parcours d’intégration'),
      value: integrations.length,
      caption: l('توجيه ومتابعة موثّقان', 'Orientations et suivis documentés'),
      Icon: HeartHandshake,
      color: 'purple',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={l('مساحة العمل / نظرة شاملة', 'ESPACE DE TRAVAIL / VUE D’ENSEMBLE')}
        title={l(`صباح الخير، ${b(p.name).split(' ')[0]}`, `Bonjour, ${b(p.name).split(' ')[0]}`)}
        description={l(
          'كل متابعة تصنع فرقاً. إليك صورة واضحة لمسارات الأطفال اليوم.',
          'Chaque suivi compte. Voici une vue claire des parcours des enfants aujourd’hui.',
        )}
        actions={
          <>
            <Link className="button secondary" to="/child-journey">
              <Compass size={17} />
              {t('childJourney')}
            </Link>
            <Link className="button secondary" to="/calendar">
              <CalendarDays size={17} />
              {l('رزنامة اليوم', 'Agenda du jour')}
            </Link>
            <Link className="button primary" to="/cases?new=1">
              <Plus size={18} />
              {t('newCase')}
            </Link>
          </>
        }
      />
      <div className="overview-strip">
        <div className="overview-strip-title">
          <span className="live-dot" />
          <strong>{b(data.centers.find((c) => c.id === session?.centerId)!.name)}</strong>
          <Badge>{l('عرض تجريبي', 'Démonstration')}</Badge>
        </div>
        <span className="muted">
          {date(brand.demoDate, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>
      <div className="kpi-grid">
        {kpis.map(({ title, value, caption, Icon, color }) => (
          <Panel key={title} className={`kpi-card ${color}`}>
            <div className="kpi-top">
              <span>{title}</span>
              <span className="kpi-icon">
                <Icon size={21} />
              </span>
            </div>
            <strong className="kpi-value">{number(value)}</strong>
            <div className="kpi-caption">
              <span className="tiny-marker" />
              {caption}
            </div>
          </Panel>
        ))}
      </div>
      <Panel className="journey-overview">
        <SectionHeading
          title={l('أين وصل الأطفال في مسارهم؟', 'Où en sont les enfants dans leur parcours ?')}
          subtitle={l(
            'توزيع الملفات النشطة على المراحل الخمس للتعهد',
            'Répartition des dossiers actifs sur les cinq étapes de prise en charge',
          )}
          actions={
            <Link className="text-link" to="/journey">
              {l('عرض المسارات', 'Voir les parcours')}
              {lang === 'ar' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
            </Link>
          }
        />
        <div className="stage-summary">
          {stages.map((s) => {
            const count = active.filter((c) => c.stage === s.id).length;
            return (
              <Link
                to={`/cases?stage=${s.id}&status=active`}
                key={s.id}
                style={{ '--stage-color': s.color } as React.CSSProperties}
              >
                <div className="stage-summary-top">
                  <span className="stage-number">0{s.id}</span>
                  <strong>
                    {number(count)}
                    <small>{l('ملفات', 'dossiers')}</small>
                  </strong>
                </div>
                <h3>{b(s.short)}</h3>
                <div className="stage-track">
                  <span style={{ width: `${(count / Math.max(active.length, 1)) * 100}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>
      <div className="dashboard-middle">
        <Panel className="chart-panel">
          <SectionHeading
            title={l('نبض المتابعة', 'L’évolution du suivi')}
            subtitle={l(
              'التسجيلات والأنشطة المنجزة • آخر ستة أشهر',
              'Inscriptions et activités réalisées • six derniers mois',
            )}
            actions={
              <Badge>
                {l('6 أشهر', '6 mois')}
                <ChevronDown size={12} />
              </Badge>
            }
          />
          <div className="chart-legend">
            <span>
              <i style={{ background: '#419e85' }} />
              {l('تسجيلات جديدة', 'Inscriptions')}
            </span>
            <span>
              <i style={{ background: '#9aacc6' }} />
              {l('أنشطة منجزة', 'Activités réalisées')}
            </span>
          </div>
          <div className="main-chart" dir="ltr">
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={monthly} margin={{ top: 14, right: 12, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="teal-chart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#419e85" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#419e85" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                  }}
                />
                <Area
                  isAnimationActive={false}
                  name={l('تسجيلات', 'Inscriptions')}
                  type="monotone"
                  dataKey="registrations"
                  stroke="#419e85"
                  strokeWidth={2.5}
                  fill="url(#teal-chart)"
                />
                <Area
                  isAnimationActive={false}
                  name={l('أنشطة', 'Activités')}
                  type="monotone"
                  dataKey="activities"
                  stroke="#9aacc6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="agenda-panel">
          <SectionHeading
            title={l('مواعيد على الأفق', 'À l’agenda')}
            subtitle={l('المقابلات والأنشطة القادمة', 'Prochains rendez-vous et activités')}
            actions={
              <Link to="/calendar" className="icon-button" title={t('calendar')}>
                <CalendarDays size={18} />
              </Link>
            }
          />
          <div className="agenda-items">
            {upcoming.map((a, i) => (
              <Link
                to={a.type === 'activity' ? '/sessions' : `/cases/${a.caseId}`}
                key={a.id}
                className="agenda-item"
              >
                <span className={`agenda-icon item-${i}`}>
                  <span>{a.time}</span>
                  <small>{date(a.date, { day: 'numeric', month: 'short' })}</small>
                </span>
                <div>
                  <h3>{b(a.title)}</h3>
                  <p>
                    {a.caseId} ·{' '}
                    {a.type === 'activity' ? l('ورشة تربوية', 'Atelier éducatif') : t(a.type)}
                  </p>
                </div>
                <i className="agenda-dot" />
              </Link>
            ))}
          </div>
          <Link to="/calendar" className="agenda-more">
            {l('فتح الرزنامة الكاملة', 'Ouvrir le calendrier')}
            {lang === 'ar' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
          </Link>
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel>
          <SectionHeading
            title={l('ملفات تستحق اهتمامك', 'Dossiers à suivre')}
            subtitle={l(
              'الأولويات حسب تاريخ الإجراء القادم',
              'Priorités selon la prochaine échéance',
            )}
            actions={
              <Link to="/cases" className="text-link">
                {l('جميع الملفات', 'Tous les dossiers')}
                <ArrowUpRight size={15} />
              </Link>
            }
          />
          <CaseTable
            cases={[...due, ...active.filter((c) => !due.includes(c))].slice(0, 4)}
            data={data}
            compact
          />
        </Panel>
        <Panel className="attendance-panel">
          <SectionHeading
            title={l('المشاركة في الأنشطة', 'Participation aux activités')}
            subtitle={l('الحصص المنجزة فقط', 'Séances réalisées uniquement')}
          />
          <div className="attendance-summary">
            <div
              className="attendance-ring"
              style={{
                background: `conic-gradient(#419e85 0 ${(present / Math.max(1, present + absent)) * 100}%, var(--border) 0 100%)`,
              }}
            >
              <div>
                <strong>
                  {number(present + absent ? Math.round((present / (present + absent)) * 100) : 0)}
                  <small>%</small>
                </strong>
                <span>{l('نسبة الحضور', 'de présence')}</span>
              </div>
            </div>
            <div className="attendance-labels">
              <span>
                <i className="green-dot" />
                {l('حضور', 'Présences')}
                <strong>{present}</strong>
              </span>
              <span>
                <i className="gray-dot" />
                {l('غياب', 'Absences')}
                <strong>{absent}</strong>
              </span>
            </div>
          </div>
          <Link to="/attendance" className="text-link">
            {l('متابعة الحضور والغياب', 'Suivre les présences')}
            <ArrowUpRight size={15} />
          </Link>
        </Panel>
      </div>
      <div className="intelligence-links">
        {[
          {
            key: 'search',
            Icon: Search,
            desc: l('المعلومة الصحيحة، في لحظتها', 'La bonne information, au bon moment'),
            tag: '01',
          },
          {
            key: 'recommendations',
            Icon: Sparkles,
            desc: l(
              'أنشطة ترتبط بأهداف تربوية واضحة',
              'Des activités liées à des objectifs clairs',
            ),
            tag: '02',
          },
          {
            key: 'assignedChildren',
            Icon: Users,
            desc: l('معرفة مشتركة، ومرافقة أفضل', 'Des savoirs partagés, un meilleur suivi'),
            tag: '03',
          },
        ].map(({ key, Icon, desc, tag }) => (
          <Link
            to={key === 'assignedChildren' ? '/assigned-children' : `/${key}`}
            className="intelligence-link"
            key={key}
          >
            <span className="intelligence-icon">
              <Icon size={21} />
            </span>
            <div>
              <h3>{t(key)}</h3>
              <p>{desc}</p>
            </div>
            <span className="module-number">{tag}</span>
          </Link>
        ))}
      </div>
      <div className="dashboard-footnote">
        <CircleCheck size={14} />
        {l(
          'كل المؤشرات محسوبة من بيانات العرض الاصطناعية. لا تمثل إحصائيات رسمية.',
          'Tous les indicateurs sont calculés à partir du jeu synthétique. Ils ne constituent pas des statistiques officielles.',
        )}
      </div>
    </>
  );
}

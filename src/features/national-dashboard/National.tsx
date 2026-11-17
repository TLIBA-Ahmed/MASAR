import { useState } from 'react';
import {
  Building2,
  Download,
  FolderHeart,
  Globe2,
  HeartHandshake,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useAggregateStats } from '../../hooks/useAggregateStats';
import { stages, skills } from '../../config/workflow';
import { addDays } from '../../utils/date';
import { Button, Info, PageHeading, Panel, SectionHeading } from '../../components/ui';
export function NationalDashboard({ local = false }: { local?: boolean }) {
  const { l, b, t } = useLocale();
  const { data, session } = useWorkspace();
  const [center, setCenter] = useState(''),
    [region, setRegion] = useState(''),
    [period, setPeriod] = useState('all');
  const from =
    period === 'month'
      ? data.demoDate.slice(0, 7) + '-01'
      : period === 'six'
        ? addDays(data.demoDate, -180)
        : undefined;
  const stats = useAggregateStats({
    centerId: local ? session!.centerId : center || undefined,
    region: region || undefined,
    from,
  });
  const exportStats = () => {
    const rows = [
      ['Centre', 'Total', ...stages.map((s) => b(s.short))],
      ...stats.centers.map((c) => [b(c.name), String(c.total), ...c.stages.map(String)]),
    ];
    const csv =
      '\ufeff' +
      rows.map((row) => row.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masar-agregats-fictifs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeading
        eyebrow={l('رؤية مستقبلية / مؤشرات مجمّعة', 'VISION FUTURE / INDICATEURS AGRÉGÉS')}
        title={t(local ? 'reports' : 'national')}
        description={l(
          'صورة موحدة لدعم القيادة، دون عرض أي هوية فردية.',
          'Une vue consolidée pour le pilotage, sans données individuelles.',
        )}
        actions={
          <Button variant="secondary" onClick={exportStats}>
            <Download size={16} />
            {l('تصدير المجاميع', 'Exporter les agrégats')}
          </Button>
        }
      />
      <Info tone="orange">
        {l(
          'محاكاة على ثلاثة مراكز تجريبية و40 ملفاً اصطناعياً. هذه ليست إحصائيات الوزارة أو قائمة رسمية للمراكز الأربعة والعشرين.',
          'Simulation sur trois centres de démonstration et 40 dossiers synthétiques. Ces chiffres ne sont ni des statistiques ministérielles ni la liste officielle des 24 CDIS.',
        )}
      </Info>
      <Panel className="national-filters">
        <span>
          <Globe2 size={18} />
          {l('نطاق المؤشرات', 'Périmètre des indicateurs')}
        </span>
        <select
          disabled={local}
          aria-label={l('الجهة', 'Gouvernorat')}
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setCenter('');
          }}
        >
          <option value="">{l('كل الجهات التجريبية', 'Toutes les régions de démo')}</option>
          {data.centers.map((c) => (
            <option key={c.id} value={c.region.fr}>
              {b(c.region)}
            </option>
          ))}
        </select>
        <select
          disabled={local}
          aria-label={l('المركز', 'Centre')}
          value={local ? session!.centerId : center}
          onChange={(e) => setCenter(e.target.value)}
        >
          <option value="">{l('كل المراكز التجريبية', 'Tous les centres de démo')}</option>
          {data.centers
            .filter((c) => !region || c.region.fr === region)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {b(c.name)}
              </option>
            ))}
        </select>
        <select
          aria-label={l('الفترة', 'Période')}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">
            {l('جميع تواريخ فتح الملفات', 'Toutes les dates d’ouverture')}
          </option>
          <option value="six">
            {l('فُتحت في آخر ستة أشهر', 'Ouverts dans les six derniers mois')}
          </option>
          <option value="month">{l('فُتحت هذا الشهر', 'Ouverts ce mois')}</option>
        </select>
      </Panel>
      <div className="kpi-grid">
        {[
          { title: l('المستفيدون', 'Bénéficiaires'), value: stats.total, Icon: Users },
          { title: t('active'), value: stats.active, Icon: FolderHeart },
          {
            title: l('المراكز التجريبية', 'Centres de démo'),
            value: stats.centers.length,
            Icon: Building2,
          },
          {
            title: l('توجيهات موثقة', 'Orientations documentées'),
            value: stats.integrations,
            Icon: HeartHandshake,
          },
        ].map(({ title, value, Icon }) => (
          <Panel className="kpi-card" key={title}>
            <div className="kpi-top">
              <span>{title}</span>
              <span className="kpi-icon">
                <Icon size={19} />
              </span>
            </div>
            <strong className="kpi-value">{value}</strong>
            <p className="kpi-caption">
              {l('إجمالي اصطناعي ضمن الفلاتر', 'Total synthétique selon les filtres')}
            </p>
          </Panel>
        ))}
      </div>
      <div className="national-grid">
        <Panel>
          <SectionHeading
            title={l('توزيع المسارات حسب المركز', 'Répartition des parcours par centre')}
            subtitle={l(
              'تشمل الملفات النشطة والمختومة والمؤرشفة ضمن الفترة المختارة.',
              'Dossiers actifs, clôturés et archivés dans la période choisie.',
            )}
          />
          <div className="center-bars">
            {stats.centers.map((c) => (
              <div key={c.id}>
                <div>
                  <strong>{b(c.name)}</strong>
                  <span>
                    {c.total} {l('ملفاً اصطناعياً', 'dossiers synthétiques')}
                  </span>
                </div>
                <div className="stacked-bar">
                  {c.stages.map((count, i) => (
                    <span
                      title={`${b(stages[i].short)}: ${count}`}
                      key={i}
                      style={{
                        width: `${(count / Math.max(c.total, 1)) * 100}%`,
                        background: stages[i].color,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="national-legend">
            {stages.map((s) => (
              <span key={s.id}>
                <i style={{ background: s.color }} />
                {b(s.short)}
              </span>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionHeading title={l('نشاط المرافقة', 'Activité d’accompagnement')} />
          <div className="national-metrics">
            {[
              [l('حصص منجزة', 'Séances réalisées'), stats.sessions],
              [l('تدخلات وملاحظات', 'Interventions et observations'), stats.interventions],
              [l('نسخ تقييم مصادق عليها', 'Versions d’évaluation validées'), stats.evaluations],
              [l('ملفات مختومة', 'Dossiers clôturés'), stats.closed],
            ].map(([title, value]) => (
              <div key={title}>
                <span>{title}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel className="national-table">
        <SectionHeading title={l('المراحل الخمس — قراءة مجمّعة', 'Les cinq étapes — vue agrégée')} />
        <div className="stage-summary">
          {stages.map((s, i) => (
            <div style={{ '--stage-color': s.color } as React.CSSProperties} key={s.id}>
              <span className="stage-number">0{s.id}</span>
              <h3>{b(s.title)}</h3>
              <strong>{stats.stages[i]}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="national-needs">
        <SectionHeading
          title={l('أهداف تربوية تستدعي موارد', 'Objectifs éducatifs nécessitant des ressources')}
          subtitle={l(
            'عدد الأهداف التي أكدها المهنيون؛ ليس تشخيصاً للاحتياجات.',
            'Nombre d’objectifs confirmés par les professionnels, sans diagnostic automatisé.',
          )}
        />
        <div>
          {stats.goals.map((g) => (
            <article key={g.skill}>
              <h3>{b(skills[g.skill as keyof typeof skills])}</h3>
              <strong>{g.count}</strong>
              <small>{l('هدف مؤكد', 'objectifs confirmés')}</small>
            </article>
          ))}
        </div>
      </Panel>
      <Info>
        <ShieldCheck size={15} />
        {l(
          'لا تتضمن هذه الواجهة أسماء أو روابط ملفات فردية. في الإنتاج، يلزم حجب أو تجميع الخلايا ذات الأعداد الصغيرة.',
          'Cette vue ne contient aucun nom ni lien individuel. En production, les cellules de faible effectif devront être masquées ou regroupées.',
        )}
      </Info>
    </>
  );
}

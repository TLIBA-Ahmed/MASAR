import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, LayoutGrid, ShieldCheck } from 'lucide-react';
import { stages } from '../../config/workflow';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Info,
  PageHeading,
  Panel,
  SectionHeading,
} from '../../components/ui';
import { DecisionModal, Timeline } from '../cases/CaseDetail';
import type { Case } from '../../types';
export function Journey() {
  const { l, b, t, date } = useLocale();
  const { data, cases } = useWorkspace();
  const [view, setView] = useState('kanban'),
    [selected, setSelected] = useState('CDIS-024');
  const active = cases.filter((c) => c.status === 'active');
  return (
    <>
      <PageHeading
        title={t('journey')}
        description={l(
          'رؤية مشتركة لمسار كل طفل، وقرارات بشرية تحافظ على التاريخ.',
          'Une vision partagée du parcours de chaque enfant, avec des décisions humaines et un historique conservé.',
        )}
        actions={
          <div className="segmented-control">
            <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
              <LayoutGrid size={14} />
              {l('لوحة المسارات', 'Kanban')}
            </button>
            <button
              className={view === 'timeline' ? 'active' : ''}
              onClick={() => setView('timeline')}
            >
              {t('history')}
            </button>
          </div>
        }
      />
      <Info>
        {l(
          'اختر ملفاً لمراجعة المراحل الفرعية واتخاذ قرار انتقال صريح. النسب تصف التقدم الإداري فقط.',
          'Ouvrez un dossier pour revoir les sous-étapes et confirmer toute transition. Les pourcentages décrivent uniquement l’avancement administratif.',
        )}
      </Info>
      {view === 'kanban' ? (
        <div className="kanban-board">
          {stages.map((stage) => (
            <section
              className="kanban-column"
              style={{ '--stage-color': stage.color } as React.CSSProperties}
              key={stage.id}
            >
              <header>
                <span className="stage-number">0{stage.id}</span>
                <h2>{b(stage.short)}</h2>
                <Badge>{active.filter((c) => c.stage === stage.id).length}</Badge>
              </header>
              {active
                .filter((c) => c.stage === stage.id)
                .map((c) => {
                  const ch = data.children.find((ch) => ch.id === c.childId)!;
                  return (
                    <Link className="panel kanban-card" to={`/cases/${c.id}`} key={c.id}>
                      <span>{c.id}</span>
                      <div>
                        <Avatar name={b(ch.name)} size="sm" />
                        <h3>{b(ch.name)}</h3>
                      </div>
                      <p>
                        <CalendarDays size={12} />
                        {date(c.nextDue, { day: 'numeric', month: 'short' })}
                      </p>
                      <div className="kanban-card-footer">
                        <span>
                          {c.goals.filter((g) => g.confirmed).length}{' '}
                          {l('أهداف مؤكدة', 'objectifs confirmés')}
                        </span>
                        <i style={{ background: stage.color }} />
                      </div>
                    </Link>
                  );
                })}
            </section>
          ))}
        </div>
      ) : (
        <Panel className="detail-info">
          <SectionHeading
            title={l('تاريخ المسار الفردي', 'Historique individuel du parcours')}
            actions={
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            }
          />
          <Timeline caseId={selected} />
        </Panel>
      )}
    </>
  );
}
export function Supervision() {
  const { l, b, t } = useLocale();
  const { data, cases, session } = useWorkspace();
  const [selected, setSelected] = useState<Case | null>(null);
  const pending = cases.filter((c) => c.status === 'active' && c.stage === 3);
  return (
    <>
      <PageHeading
        title={t('supervision')}
        description={l(
          'مراجعة بشرية للمشاريع تسبق التدخلات، مع توثيق القرار وتعليله.',
          'Une revue humaine des projets avant les interventions, avec décision motivée.',
        )}
      />
      {session?.role !== 'administration' && (
        <Info tone="orange">
          {l(
            'للمصادقة، بدّل الهوية التجريبية إلى الإدارة عبر صفحة الفريق المهني.',
            'Pour valider, choisissez le profil Administration dans l’équipe professionnelle.',
          )}{' '}
          <Link to="/professionals">{t('professionals')}</Link>
        </Info>
      )}
      <Panel>
        <SectionHeading
          title={l('مشاريع التأهيل والمتابعة', 'Projets de réhabilitation à suivre')}
          subtitle={l(
            'المتطلبات المؤسسية النهائية تبقى قيد التأكيد.',
            'Les exigences institutionnelles restent à confirmer.',
          )}
        />
        {pending.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{l('الملف', 'Dossier')}</th>
                  <th>{l('الأهداف المؤكدة', 'Objectifs confirmés')}</th>
                  <th>{l('الوثائق المصادق عليها', 'Documents validés')}</th>
                  <th>{l('الإشراف', 'Supervision')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/cases/${c.id}`}>
                        <strong>{b(data.children.find((ch) => ch.id === c.childId)!.name)}</strong>
                        <small className="table-cell-sub">{c.id}</small>
                      </Link>
                    </td>
                    <td>{c.goals.filter((g) => g.confirmed).length}</td>
                    <td>
                      {
                        data.submissions.filter(
                          (s) => s.caseId === c.id && s.status === 'validated',
                        ).length
                      }
                    </td>
                    <td>
                      <Badge tone={c.supervised ? 'green' : 'orange'}>
                        {c.supervised
                          ? l('تمت المراجعة', 'Revu')
                          : l('في انتظار المراجعة', 'À revoir')}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => setSelected(c)}
                        disabled={session?.role !== 'administration'}
                      >
                        <ShieldCheck size={14} />
                        {l('توثيق قرار', 'Documenter une décision')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('noResults')} />
        )}
      </Panel>
      {selected && <DecisionModal c={selected} open onClose={() => setSelected(null)} />}
    </>
  );
}

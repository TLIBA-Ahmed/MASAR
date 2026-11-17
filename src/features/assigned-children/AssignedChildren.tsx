import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderHeart,
  Users,
  Search,
  ArrowUpRight,
  LayoutGrid,
  List,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { normalize } from '../../services/search';
import type { Bi } from '../../types';
import { Badge, Button, Empty, Field, Info, PageHeading, Panel } from '../../components/ui';
import { GroupAccessPanel } from './GroupAccessPanel';
export interface AssignedGroup {
  group_id: string;
  group_name: Bi;
  group_code: string;
  centre: { name: Bi };
  role: string;
  assignment_status: string;
  active_child_count: number;
}
interface Roster {
  children: { case_id: string; name: Bi; stage: number; status: string }[];
  count: number;
}
export function AssignedChildren() {
  const { l, b, t } = useLocale();
  const { session, data, refresh } = useWorkspace();
  const [groups, setGroups] = useState<AssignedGroup[]>([]),
    [selected, setSelected] = useState(''),
    [roster, setRoster] = useState<Roster | null>(null);
  const [query, setQuery] = useState(''),
    [childQuery, setChildQuery] = useState(''),
    [view, setView] = useState('grid'),
    [stage, setStage] = useState('all'),
    [sort, setSort] = useState('id'),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const key = `${session?.sessionId}:${data.backend?.fingerprint}`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRoster(null);
    void api<{ groups: AssignedGroup[] }>('/me/assigned-groups', undefined, {
      signal: controller.signal,
    })
      .then((r) => {
        setGroups(r.groups);
        setSelected((current) => (r.groups.some((g) => g.group_id === current) ? current : ''));
        setError(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setGroups([]);
          setError(Boolean(e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key]);
  useEffect(() => {
    setRoster(null);
    if (!selected) return;
    const controller = new AbortController();
    void api<Roster>(`/groups/${selected}/children`, undefined, { signal: controller.signal })
      .then(setRoster)
      .catch(() => {
        if (!controller.signal.aborted) {
          setSelected('');
          void refresh();
        }
      });
    return () => controller.abort();
  }, [selected, key, refresh]);
  const visible = groups.filter((g) =>
    normalize(`${b(g.group_name)} ${g.group_code}`).includes(normalize(query)),
  );
  const children = (roster?.children ?? [])
    .filter(
      (c) =>
        normalize(`${c.case_id} ${b(c.name)}`).includes(normalize(childQuery)) &&
        (stage === 'all' || String(c.stage) === stage),
    )
    .toSorted((a, z) =>
      sort === 'name' ? b(a.name).localeCompare(b(z.name)) : a.case_id.localeCompare(z.case_id),
    );
  return (
    <>
      <PageHeading
        eyebrow={l('مساحة العمل / التكليفات النشطة', 'ESPACE DE TRAVAIL / AFFECTATIONS ACTIVES')}
        title={t('assignedChildren')}
        description={l(
          'مجموعاتك وأطفالها، ضمن نطاق تكليفك المهني الحالي.',
          'Vos groupes et leurs enfants, dans le périmètre de votre affectation actuelle.',
        )}
        actions={
          <>
            <Link
              className="button primary"
              to={`/child-journey${selected ? `?group=${encodeURIComponent(selected)}` : ''}`}
            >
              <ArrowUpRight size={16} />
              {t('childJourney')}
            </Link>
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw size={16} />
              {l('تحديث', 'Actualiser')}
            </Button>
          </>
        }
      />
      <div className="assigned-hero">
        <div className="assigned-hero-icon">
          <FolderHeart size={32} />
        </div>
        <div>
          <span className="eyebrow">MASAR / {l('المرافقة البشرية', 'ACCOMPAGNEMENT HUMAIN')}</span>
          <h2>
            {l('كل تكليف، مسؤولية مشتركة.', 'Chaque affectation, une responsabilité partagée.')}
          </h2>
          <p>
            {l(
              'افتح المجموعة للوصول إلى الملفات المسموح بها. يُعاد التحقق من الوصول عند كل طلب.',
              'Ouvrez un groupe pour retrouver les dossiers autorisés. Chaque demande vérifie à nouveau les accès.',
            )}
          </p>
        </div>
        <ShieldCheck size={48} strokeWidth={1} />
      </div>
      <Panel className="filter-bar">
        <Search size={18} />
        <input
          aria-label={l('البحث في المجموعات', 'Rechercher un groupe')}
          placeholder={l('اسم المجموعة أو رمزها…', 'Nom ou code du groupe…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Badge tone="green">
          {visible.length} {l('مجموعات', 'groupes')}
        </Badge>
        <Button variant="ghost" onClick={() => setView(view === 'grid' ? 'table' : 'grid')}>
          {view === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}{' '}
          {l('تغيير العرض', 'Changer la vue')}
        </Button>
      </Panel>
      {loading ? (
        <Panel>
          <p role="status">{t('loading')}</p>
        </Panel>
      ) : error ? (
        <Info>
          {l(
            'تعذر تحميل المجموعات. تحقق من تشغيل الخادم.',
            'Impossible de charger les groupes. Vérifiez le démarrage du backend.',
          )}
        </Info>
      ) : !groups.length ? (
        <Empty
          title={l('لا توجد مجموعات مكلّف بها حالياً', 'Aucune affectation de groupe active')}
          description={l(
            'قد تبقى ملفات فردية متاحة وفق تكليف مستقل.',
            'Des dossiers individuels peuvent rester accessibles selon une affectation distincte.',
          )}
          action={
            <Link className="button secondary" to="/cases">
              {t('cases')}
            </Link>
          }
        />
      ) : view === 'grid' ? (
        <div className="assigned-group-grid">
          {visible.map((g) => (
            <button
              key={g.group_id}
              className={`assigned-group-card ${selected === g.group_id ? 'selected' : ''}`}
              onClick={() => setSelected(g.group_id)}
            >
              <span className="group-card-top">
                <span className="group-card-icon">
                  <Users size={24} />
                </span>
                <Badge tone="green" dot>
                  {l('تكليف نشط', 'Affectation active')}
                </Badge>
              </span>
              <small>{g.group_code}</small>
              <h2>{b(g.group_name)}</h2>
              <p>
                {b(g.centre.name)} · {t(g.role)}
              </p>
              <span className="group-card-footer">
                <strong>
                  {g.active_child_count} <span>{l('أطفال مرئيون', 'enfants visibles')}</span>
                </strong>
                <ArrowUpRight size={20} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Panel>
          <table className="data-table">
            <thead>
              <tr>
                <th>{l('المجموعة', 'Groupe')}</th>
                <th>{l('المركز', 'Centre')}</th>
                <th>{l('الأطفال المرئيون', 'Enfants visibles')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.group_id}>
                  <td>
                    {b(g.group_name)}
                    <small className="table-sub">{g.group_code}</small>
                  </td>
                  <td>{b(g.centre.name)}</td>
                  <td>{g.active_child_count}</td>
                  <td>
                    <Button variant="secondary" onClick={() => setSelected(g.group_id)}>
                      {l('فتح', 'Ouvrir')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {selected && (
        <Panel className="assigned-roster">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {groups.find((g) => g.group_id === selected)?.group_code}
              </span>
              <h2>{b(groups.find((g) => g.group_id === selected)!.group_name)}</h2>
            </div>
            <Badge>
              {roster?.count ?? '…'} {l('أطفال', 'enfants')}
            </Badge>
          </div>
          <div className="filter-bar">
            <input
              aria-label={l('البحث في الأطفال', 'Rechercher un enfant')}
              value={childQuery}
              onChange={(e) => setChildQuery(e.target.value)}
              placeholder={l('رمز الطفل أو رقم الملف', 'Code enfant ou numéro de dossier')}
            />
            <Field label={l('المرحلة', 'Étape')}>
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="all">{t('all')}</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l('الترتيب', 'Trier')}>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="id">{l('رقم الملف', 'Numéro du dossier')}</option>
                <option value="name">{l('رمز الطفل', 'Code enfant')}</option>
              </select>
            </Field>
          </div>
          {!roster ? (
            <p role="status">{t('loading')}</p>
          ) : !children.length ? (
            <Empty title={t('noResults')} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{l('الملف', 'Dossier')}</th>
                  <th>{l('الطفل', 'Enfant')}</th>
                  <th>{l('المرحلة', 'Étape')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr key={c.case_id}>
                    <td>
                      <span className="mono">{c.case_id}</span>
                    </td>
                    <td>{b(c.name)}</td>
                    <td>
                      <Badge>{c.stage}/5</Badge>
                    </td>
                    <td>
                      <Link className="button secondary" to={`/cases/${c.case_id}`}>
                        {l('فتح الملف', 'Ouvrir le dossier')}
                        <ArrowUpRight size={15} />
                      </Link>
                      <Link className="button ghost" to={`/child-journey/${c.case_id}`}>
                        {l('عرض المسار', 'Voir le parcours')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
      {selected && <GroupAccessPanel key={selected} groupId={selected} />}
    </>
  );
}

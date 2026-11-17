import { useEffect, useState } from 'react';
import { setSearchDraft } from '../../services/searchDraft';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronsLeft,
  FileCheck2,
  FileStack,
  FolderHeart,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useAppStore } from '../../stores/app';
import { Avatar, Button, IconButton, Modal } from '../ui';
import { brand } from '../../config/brand';
import { InstitutionalLogo } from './InstitutionalLogo';
import { GlobalSearch } from '../search/GlobalSearch';
import { accessPolicyService } from '../../services/accessPolicy';
import { features } from '../../config/features';
const groups: { label?: [string, string]; items: [string, string, LucideIcon][] }[] = [
  {
    label: ['مساحة العمل', 'Espace de travail'],
    items: [
      ['assignedChildren', '/assigned-children', Users],
      ['childJourney', '/child-journey', Waypoints],
      ['search', '/search', Search],
      ['recommendations', '/recommendations', Sparkles],
      ...(features.professionalNetwork
        ? [['network', '/network', MessageCircle] as [string, string, LucideIcon]]
        : []),
    ],
  },
  {
    label: ['الملفات والمتابعة', 'Dossiers et suivi'],
    items: [
      ['dashboard', '/dashboard', LayoutDashboard],
      ['cases', '/cases', FolderHeart],
      ['journey', '/journey', Waypoints],
      ['tasks', '/tasks', ListTodo],
      ['calendar', '/calendar', CalendarDays],
    ],
  },
  {
    label: ['المرافقة والمتابعة', 'Accompagnement'],
    items: [
      ['interviews', '/interviews', MessageCircle],
      ['assessments', '/assessments', FileCheck2],
      ['projects', '/projects', FileStack],
      ['interventions', '/interventions', Activity],
      ['sessions', '/sessions', Users],
      ['attendance', '/attendance', CheckCheck],
    ],
  },
  {
    label: ['القيادة والوثائق', 'Pilotage et documentation'],
    items: [
      ['documents', '/documents', FileStack],
      ['library', '/library', BookOpen],
      ['supervision', '/supervision', ShieldCheck],
      ['reports', '/reports', Activity],
      ['professionals', '/professionals', Users],
      ['settings', '/settings', Settings2],
    ],
  },
];
// Retain page titles and quick navigation for modules accessed outside the sidebar.
const additionalDestinations: [string, string, LucideIcon][] = [
  ['search', '/search', Search],
  ['library', '/library', BookOpen],
];
export function LanguageSwitch() {
  const { lang, setLanguage } = useLocale();
  return (
    <div className="language-switch" aria-label="العربية | Français">
      <button className={lang === 'ar' ? 'selected' : ''} onClick={() => setLanguage('ar')}>
        العربية
      </button>
      <span />
      <button className={lang === 'fr' ? 'selected' : ''} onClick={() => setLanguage('fr')}>
        Français
      </button>
    </div>
  );
}
export function Shell() {
  const { l, t, b } = useLocale();
  const { session, data, storage, signIn, signOut, retry } = useAppStore();
  const accessKey = accessPolicyService.contextKey(data, session);
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [command, setCommand] = useState(false),
    [query, setQuery] = useState(''),
    [notifications, setNotifications] = useState(false),
    [theme, setTheme] = useState(localStorage.getItem('masar.theme') ?? 'light');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({
    0: true,
    1: false,
    2: false,
    3: false,
  });
  const location = useLocation(),
    navigate = useNavigate();
  const p = data.professionals.find((p) => p.id === session?.professionalId)!;
  const center = data.centers.find((c) => c.id === session?.centerId)!;
  const items = [...groups.flatMap((g) => g.items), ...additionalDestinations];
  const active = items.find((item) => location.pathname.startsWith(item[1]))?.[0] ?? 'dashboard';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('masar.theme', theme);
  }, [theme]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const go = (path: string) => {
    setCommand(false);
    setQuery('');
    navigate(path);
  };
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label={l('إغلاق القائمة', 'Fermer le menu')}
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link to="/assigned-children" className="brand">
          <img src={brand.logo} alt="" />
          <div>
            <strong>
              {brand.arabicName}
              <span>MASAR</span>
            </strong>
            <small>{l('مسارات تصنع الأثر', 'Des parcours qui comptent')}</small>
          </div>
        </Link>
        <InstitutionalLogo className="sidebar-institutional-logo" />
        <div className="center-switch">
          <span className="center-icon">
            <FolderHeart size={18} />
          </span>
          <div>
            <strong>{b(center.name)}</strong>
            <small>{l('مساحة العمل المهنية', 'Espace professionnel')}</small>
            {(session?.authorizedCentreIds?.length ?? 0) > 1 && <Link className="centre-change-link" to="/select-centre">{l('تغيير المركز', 'Changer de centre')}</Link>}
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label={l('التنقل الرئيسي', 'Navigation principale')}>
          {groups.map((group, i) => (
            <div className="nav-group" key={i}>
              {group.label && (
                <button
                  className="nav-group-title"
                  onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                  aria-expanded={expanded[i]}
                >
                  {l(...group.label)}
                  <ChevronDown size={12} className={expanded[i] ? '' : 'rotate'} />
                </button>
              )}
              {(!group.label || expanded[i] || collapsed) &&
                group.items.map(([key, path, Icon]) => (
                  <NavLink
                    title={t(key)}
                    to={path}
                    key={key}
                    onClick={() => setMobile(false)}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={19} />
                    <span>{t(key)}</span>
                    {key === 'recommendations' && <i className="nav-new" />}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="profile" to="/professionals">
            <Avatar name={b(p.name)} color={1} />
            <div>
              <strong>{b(p.name)}</strong>
              <small>{t(p.role)}</small>
            </div>
            <Settings2 size={16} />
          </Link>
          <div className="sidebar-note">
            <span className="live-dot" />
            {l('نموذج تجريبي • بيانات اصطناعية', 'Prototype • Données synthétiques')}
            <IconButton label={t('signout')} onClick={signOut}>
              <LogOut size={16} />
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <IconButton
              label={l('إظهار القائمة', 'Afficher le menu')}
              onClick={() => {
                if (window.innerWidth < 1000) setMobile((v) => !v);
                else setCollapsed((v) => !v);
              }}
            >
              <Menu size={20} />
            </IconButton>
            <span className="breadcrumb">
              {l('مساحة العمل', 'Espace de travail')}
              <span>/</span>
              <strong>{t(active)}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <GlobalSearch key={accessKey} />
            <label className="demo-profile-selector">
              <span>{l('ملف تجريبي', 'Profil démo')}</span>
              <select
                aria-label={l(
                  'اختيار الملف المهني التجريبي',
                  'Sélection du profil de démonstration',
                )}
                value={session?.userId}
                onChange={(event) => void signIn(event.target.value).catch(() => undefined)}
              >
                {data.professionals.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {b(profile.name)} · {t(profile.role)}
                  </option>
                ))}
              </select>
            </label>
            <LanguageSwitch />
            <IconButton
              label={l('تبديل المظهر', 'Changer le thème')}
              onClick={() => setTheme((v) => (v === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </IconButton>
            <div className="notification-wrap">
              <IconButton
                label={l('الإشعارات', 'Notifications')}
                onClick={() => setNotifications((v) => !v)}
              >
                <Bell size={19} />
                <i className="notification-dot" />
              </IconButton>
              {notifications && (
                <div className="notification-popover">
                  <h3>{l('متابعة اليوم', 'À suivre aujourd’hui')}</h3>
                  {accessPolicyService
                    .authorizedData(data, session)
                    .tasks.filter((task) => !task.completed && task.professionalId === p.id)
                    .slice(0, 4)
                    .map((task) => (
                      <button
                        key={task.id}
                        onClick={() => {
                          navigate('/tasks');
                          setNotifications(false);
                        }}
                      >
                        {b(task.title)}
                        <small>
                          {task.caseId} · {task.dueDate}
                        </small>
                      </button>
                    ))}
                  <Link to="/calendar" onClick={() => setNotifications(false)}>
                    {t('calendar')}
                  </Link>
                </div>
              )}
            </div>
            {features.professionalNetwork && (
              <Link title={t('network')} className="icon-button" to="/network?tab=messages">
                <MessageCircle size={19} />
              </Link>
            )}
            <Avatar name={b(p.name)} size="sm" color={1} />
          </div>
        </header>
        {storage === 'error' && (
          <div className="storage-error" role="alert">
            {l(
              'تعذر الاتصال بالخادم. قد تكون المعلومات المعروضة قديمة؛ أعد التحديث.',
              'Communication avec le backend interrompue. Les informations affichées peuvent être anciennes ; actualisez.',
            )}
            <Button variant="secondary" onClick={() => void retry()}>
              {l('إعادة المحاولة', 'Réessayer')}
            </Button>
          </div>
        )}
        <main id="main-content" className="main-content" key={accessKey}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>{t('demo')}</span>
          <span>
            <i className={`live-dot ${storage === 'saving' ? 'saving' : ''}`} />
            {storage === 'saving'
              ? l('جارٍ الحفظ…', 'Enregistrement…')
              : storage === 'error'
                ? l('خطأ في التخزين', 'Erreur de stockage')
                : l('محفوظ في قاعدة مسار المحلية', 'Enregistré dans la base MASAR locale')}
            <span>·</span>
            <button className="text-link" onClick={() => navigate('/settings')}>
              {l(
                'سياسات عرض تجريبي — بيانات اصطناعية فقط',
                'Politiques de démonstration — données synthétiques uniquement',
              )}
            </button>
          </span>
        </footer>
      </div>
      <Modal
        open={command}
        onClose={() => setCommand(false)}
        title={l('إلى أين تريد الانتقال؟', 'Où souhaitez-vous aller ?')}
        description={l(
          'ابحث عن مساحة عمل أو ملف أو وثيقة.',
          'Recherchez un espace, un dossier ou un document.',
        )}
      >
        <div className="command-search">
          <Search size={20} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={l('ابحث أو اكتب أمراً…', 'Rechercher ou saisir une commande…')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query) {
                setSearchDraft(query);
                go('/search');
              }
            }}
          />
          <kbd>↵</kbd>
        </div>
        <div className="command-results">
          {items
            .filter(([key]) => !query || t(key).toLowerCase().includes(query.toLowerCase()))
            .slice(0, 7)
            .map(([key, path, Icon]) => (
              <button key={key} onClick={() => go(path)}>
                <Icon size={18} />
                <span>{t(key)}</span>
                <ChevronsLeft size={15} />
              </button>
            ))}
          {query && (
            <button
              onClick={() => {
                setSearchDraft(query);
                go('/search');
              }}
            >
              <Search size={18} />
              {l(
                'البحث في الملفات والوثائق عن',
                'Rechercher dans les dossiers et documents :',
              )} « {query} »
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}

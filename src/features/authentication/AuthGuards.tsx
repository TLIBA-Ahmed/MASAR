import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Building2, ShieldCheck, ShieldX } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useAppStore } from '../../stores/app';
import { Button } from '../../components/ui';
import { clearReturnPath, returnPath, safeReturnPath, saveWorkplace } from './entryContext';
import { useEntryResource } from './useEntryResource';
import { EntryFooter, EntryHeader } from './GovernorateWelcomePage';

export function EntryLanding({ afterLogin = false }: { afterLogin?: boolean }) {
  const session = useAppStore((s) => s.session);
  return (
    <Navigate
      to={
        afterLogin && (session?.authorizedCentreIds?.length ?? 0) > 1
          ? '/select-centre'
          : returnPath()
      }
      replace
    />
  );
}
export function RequireSession() {
  const { session, authenticating } = useAppStore();
  const { l } = useLocale();
  const location = useLocation();
  useEffect(() => {
    if (session && location.pathname !== '/select-centre') clearReturnPath();
  }, [session, location.pathname]);
  if (!session && authenticating)
    return (
      <main className="app-loader">
        <img src="/masar.svg" alt="MASAR" />
        <div className="loading-line" />
        <p role="status">
          {l('التحقق من الهوية المهنية…', 'Vérification de l’identité professionnelle…')}
        </p>
      </main>
    );
  if (!session)
    return (
      <Navigate
        to="/"
        replace
        state={{ returnTo: safeReturnPath(location.pathname + location.search) }}
      />
    );
  return <Outlet />;
}
export function RequireCaseAccess() {
  const { caseId = '' } = useParams();
  const { l } = useLocale();
  const { data, error, retry } = useEntryResource(`/cases/${encodeURIComponent(caseId)}/access`);
  if (error)
    return (
      <section className="panel entry-access-denied" role="alert">
        <ShieldX size={34} />
        <h1>{l('الوصول مرفوض', 'Accès refusé')}</h1>
        <p>
          {l(
            'هذا الملف غير متاح ضمن تكليفاتك وصلاحياتك الحالية.',
            'Ce dossier n’est pas accessible avec vos affectations et droits actuels.',
          )}
        </p>
        <Button variant="secondary" onClick={retry}>
          {l('إعادة التحقق', 'Vérifier à nouveau')}
        </Button>
        <p>
          <Link to="/assigned-children">
            {l('العودة إلى الأطفال المتعهد بهم', 'Revenir aux enfants pris en charge')}
          </Link>
        </p>
      </section>
    );
  if (!data)
    return <p role="status">{l('التحقق من صلاحية الوصول…', 'Vérification de l’accès…')}</p>;
  return <Outlet />;
}
export function SessionCentrePicker() {
  const { l, b, lang } = useLocale();
  const { centreChoices, session, selectCentre, signOut } = useAppStore();
  const [selected, setSelected] = useState(session?.centerId ?? '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const navigate = useNavigate();
  const centre = centreChoices.find((c) => c.id === selected);
  return (
    <div className="welcome-page">
      <EntryHeader />
      <main className="centre-picker">
        <ShieldCheck size={32} color="#419e85" />
        <h1>{l('اختر مساحة عملك', 'Choisissez votre espace de travail')}</h1>
        <p>
          {l(
            'تم التحقق من هويتك التجريبية. تظهر فقط المراكز المرتبطة بتكليفاتك النشطة.',
            'Votre identité de démonstration est vérifiée. Seuls les centres de vos affectations actives sont proposés.',
          )}
        </p>
        <div className="centre-picker-options">
          {centreChoices.map((c) => (
            <label key={c.id}>
              <input
                type="radio"
                name="verified-centre"
                value={c.id}
                checked={selected === c.id}
                onChange={() => setSelected(c.id)}
                disabled={busy}
              />
              <Building2 size={21} />
              <span>
                {b(c.name)}
                <small>
                  {b(c.region)}
                  {c.isDemo ? ` · ${l('مركز تجريبي', 'Centre de démonstration')}` : ''}
                </small>
              </span>
            </label>
          ))}
        </div>
        {!centreChoices.length && (
          <p role="alert">
            {l(
              'لم يعد هناك تكليف نشط. عد إلى اختيار الولاية.',
              'Aucune affectation active. Revenez à la sélection du gouvernorat.',
            )}
          </p>
        )}
        {error && (
          <p className="welcome-entry-error" role="alert">
            {l(
              'المركز غير متاح أو انتهى التكليف. اختر مركزاً آخر أو عد إلى البداية.',
              'Centre indisponible ou affectation expirée. Choisissez un autre centre ou revenez à l’accueil.',
            )}
          </p>
        )}
        <Button
          disabled={!centre || busy}
          onClick={() => {
            if (!centre) return;
            setBusy(true);
            setError(false);
            const workplace = { governorateId: centre.governorateId, centreId: centre.id };
            void selectCentre(workplace)
              .then(() => {
                saveWorkplace(workplace);
                navigate(returnPath(), { replace: true });
              })
              .catch(() => {
                setError(true);
                setBusy(false);
              });
          }}
        >
          {busy
            ? l('التحقق…', 'Vérification…')
            : l('فتح مساحة العمل', 'Ouvrir mon espace de travail')}
        </Button>
        <button
          type="button"
          className="welcome-demo-shortcut"
          onClick={() => {
            signOut();
            navigate('/', { replace: true });
          }}
        >
          {lang === 'ar' ? 'العودة إلى اختيار الولاية' : 'Revenir au choix du gouvernorat'}
        </button>
      </main>
      <EntryFooter />
    </div>
  );
}

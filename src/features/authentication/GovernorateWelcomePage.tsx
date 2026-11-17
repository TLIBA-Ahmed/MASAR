import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { brand } from '../../config/brand';
import { useLocale } from '../../i18n';
import { LanguageSwitch } from '../../components/layout/Shell';
import { InstitutionalLogo } from '../../components/layout/InstitutionalLogo';
import { Badge, Button } from '../../components/ui';
import { useAppStore } from '../../stores/app';
import { GovernorateMap } from './GovernorateMap';
import {
  governorates,
  normalizeEntrySearch,
  readWorkplace,
  saveReturnPath,
  saveWorkplace,
} from './entryContext';
import type { EntryCentre, Governorate, WorkplaceSelection } from './entryContext';
import { useEntryResource } from './useEntryResource';
import './welcome.css';

export function EntryHeader() {
  const { l } = useLocale();
  return (
    <header className="welcome-header">
      <Link className="brand dark" to="/" aria-label="MASAR">
        <img src={brand.logo} alt="" />
        <strong>
          مسار <span>MASAR</span>
        </strong>
      </Link>
      <span className="welcome-brand-description">
        {l('مسارات تصنع الأثر', 'Des parcours qui font la différence')}
      </span>
      <InstitutionalLogo className="welcome-institutional-logo" />
      <LanguageSwitch />
    </header>
  );
}
export function EntryFooter() {
  const { l } = useLocale();
  return (
    <footer className="welcome-footer">
      <span>MASAR · Social Tech Challenge 2026</span>
      <span>
        <i className="live-dot" />
        {l('نموذج تجريبي · بيانات اصطناعية', 'Prototype de démonstration · Données synthétiques')}
      </span>
    </footer>
  );
}
export function GovernorateWelcomePage() {
  const { l, b, lang } = useLocale();
  const location = useLocation(),
    navigate = useNavigate();
  const mode = useAppStore((s) => s.identityMode);
  const retryBootstrap = useAppStore((s) => s.retry);
  const [selection, setSelection] = useState<WorkplaceSelection | null>(readWorkplace);
  const [query, setQuery] = useState('');
  const registry = useEntryResource<Governorate[]>('/entry/governorates');
  const resource = useEntryResource<EntryCentre[]>(
    selection ? `/entry/governorates/${selection.governorateId}/centres` : null,
  );
  useEffect(() => {
    saveReturnPath((location.state as { returnTo?: unknown } | null)?.returnTo);
  }, [location.state]);
  const selected = governorates.find((g) => g.id === selection?.governorateId);
  const centres = resource.data ?? [];
  const centre =
    centres.find((c) => c.id === selection?.centreId) ??
    (centres.length === 1 ? centres[0] : undefined);
  const filter = normalizeEntrySearch(query);
  const shown = (registry.data ?? governorates).filter((g) =>
    normalizeEntrySearch(`${g.name.ar} ${g.name.fr}`).includes(filter),
  );
  function select(governorateId: string) {
    const value = {
      governorateId,
      centreId: selection?.governorateId === governorateId ? selection.centreId : '',
    };
    setSelection(value);
    saveWorkplace(value);
  }
  return (
    <div className="welcome-page">
      <EntryHeader />
      <main className="welcome-main">
        <div className="welcome-intro">
          <Badge tone="green" dot>
            {l('مرحباً بكم في مسار', 'Bienvenue sur MASAR')}
          </Badge>
          <h1>
            {l('كل مسار يبدأ', 'Chaque parcours commence')} <span>{l('من هنا.', 'ici.')}</span>
          </h1>
          <p>
            {l(
              'اختر ولاية عملك للوصول إلى فضائك المهني ومواصلة المرافقة.',
              'Choisissez votre gouvernorat de travail pour rejoindre votre espace professionnel.',
            )}
          </p>
        </div>
        <ol className="welcome-steps" aria-label={l('خطوات الدخول', 'Étapes de connexion')}>
          <li className="current" aria-current="step">
            <span>01</span>
            {l('مكان العمل', 'Votre territoire')}
          </li>
          <li>
            <span>02</span>
            {l('الهوية المهنية', 'Votre identité')}
          </li>
          <li>
            <span>03</span>
            {l('مساحة العمل', 'Votre espace')}
          </li>
        </ol>
        <div className="welcome-grid">
          <section
            className="welcome-map-panel"
            aria-label={l('اختيار الولاية من الخريطة', 'Sélection sur la carte')}
          >
            <div className="welcome-map-heading">
              <span>
                <MapPin size={15} />
                {l('تونس · 24 ولاية', 'TUNISIE · 24 GOUVERNORATS')}
              </span>
              <small>
                {l('انقر على الخريطة أو استخدم القائمة', 'Explorez la carte ou utilisez la liste')}
              </small>
            </div>
            <GovernorateMap selected={selected?.id} onSelect={select} />
            <div className="welcome-map-caption">
              <span>
                <i />
                {l('ولاية مختارة', 'Gouvernorat sélectionné')}
              </span>
              <span>
                {l('اختيار مهني، دون تحديد موقعك', 'Lieu de travail, sans accès à votre position')}
              </span>
            </div>
            <div className="welcome-map-credit">
              <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">
                geoBoundaries
              </a>{' '}
              ·{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                © OpenStreetMap
              </a>{' '}
              ·{' '}
              <a href="/geography/tunisia-governorates.geojson" download>
                {l('البيانات والترخيص', 'Données et licence')}
              </a>
            </div>
          </section>
          <section className="welcome-selection-panel" aria-labelledby="welcome-selection-title">
            <div className="welcome-panel-title">
              <span className="welcome-step-number">01</span>
              <div>
                <h2 id="welcome-selection-title">
                  {l('اختر الولاية التي تعمل بها', 'Sélectionnez votre gouvernorat de travail')}
                </h2>
                <p>
                  {l(
                    'اختيارك يحدد سياق الدخول إلى مسار.',
                    'Votre sélection prépare votre connexion à MASAR.',
                  )}
                </p>
              </div>
            </div>
            <label className="welcome-search">
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={l('ابحث عن ولاية…', 'Rechercher un gouvernorat…')}
                aria-label={l('البحث عن ولاية', 'Rechercher un gouvernorat')}
              />
            </label>
            <ul
              className="governorate-list"
              aria-label={l('الولايات الأربع والعشرون', 'Les 24 gouvernorats')}
            >
              {shown.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-pressed={selected?.id === g.id}
                    onClick={() => select(g.id)}
                  >
                    <span>{b(g.name)}</span>
                    {selected?.id === g.id ? (
                      <Check size={15} />
                    ) : (
                      <span className="governorate-list-dot" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!shown.length && (
              <p className="welcome-empty" role="status">
                {l('لا توجد ولاية مطابقة.', 'Aucun gouvernorat correspondant.')}
              </p>
            )}
            <div
              className={`welcome-confirmation ${selected ? 'has-selection' : ''}`}
              aria-live="polite"
            >
              <MapPin size={22} />
              <div>
                <small>{l('الولاية المختارة', 'Gouvernorat sélectionné')}</small>
                <strong>
                  {selected
                    ? b(selected.name)
                    : l('لم يتم الاختيار بعد', 'Votre territoire vous attend')}
                </strong>
                {selected && <span>{lang === 'ar' ? selected.name.fr : selected.name.ar}</span>}
              </div>
              {selected && <CheckCheck size={21} />}
            </div>
            {resource.loading && (
              <p className="welcome-resource-state" role="status">
                {l('تحميل المراكز المتاحة…', 'Chargement des centres disponibles…')}
              </p>
            )}
            {(resource.error || registry.error) && (
              <div className="welcome-entry-error" role="alert">
                <p>
                  {l(
                    'تعذر تحميل سجل الدخول. حاول مجدداً.',
                    'Impossible de charger le registre. Réessayez.',
                  )}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    registry.retry();
                    resource.retry();
                    if (mode === 'unavailable') void retryBootstrap();
                  }}
                >
                  {l('إعادة المحاولة', 'Réessayer')}
                </Button>
              </div>
            )}
            {selected && resource.data && !centres.length && (
              <div className="welcome-empty" role="status">
                <Building2 size={21} />
                <p>
                  {l(
                    'لا يوجد مركز تجريبي مسجل لهذه الولاية حالياً. اختر ولاية أخرى أو جرّب سليانة.',
                    'Aucun centre de démonstration configuré pour ce gouvernorat. Choisissez un autre territoire ou essayez Siliana.',
                  )}
                </p>
              </div>
            )}
            {centres.length > 1 && (
              <label className="welcome-centre-field">
                {l('اختر المركز', 'Choisir le centre')}
                <select
                  value={centre?.id ?? ''}
                  onChange={(e) => {
                    const value = { governorateId: selected!.id, centreId: e.target.value };
                    setSelection(value);
                    saveWorkplace(value);
                  }}
                >
                  <option value="" disabled>
                    {l('اختر مركزاً…', 'Sélectionnez un centre…')}
                  </option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {b(c.name)}
                      {c.isDemo ? ` · ${l('تجريبي', 'Démo')}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {centre && (
              <div className="welcome-centre">
                <Building2 size={19} />
                <div>
                  <strong>{b(centre.name)}</strong>
                  <small>
                    {centre.isDemo
                      ? l(
                          'مركز تجريبي · ليس سجلاً رسمياً',
                          'Centre de démonstration · Registre non officiel',
                        )
                      : l('مركز مسجل', 'Centre enregistré')}
                  </small>
                </div>
              </div>
            )}
            <Button
              className="welcome-continue"
              disabled={
                !selected ||
                !centre ||
                resource.loading ||
                resource.error ||
                registry.error ||
                mode !== 'demo'
              }
              onClick={() => {
                if (!selected || !centre) return;
                saveWorkplace({ governorateId: selected.id, centreId: centre.id });
                navigate('/login');
              }}
            >
              {l('متابعة إلى تسجيل الدخول', 'Continuer vers la connexion')}
              {lang === 'ar' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </Button>
            <button
              type="button"
              className="welcome-demo-shortcut"
              onClick={() => {
                select('TN-34');
                setQuery('');
              }}
            >
              {l(
                'اكتشف السيناريو التجريبي في سليانة',
                'Découvrir le scénario de démonstration à Siliana',
              )}
            </button>
            <p className="welcome-security">
              <ShieldCheck size={17} />
              <span>
                {l(
                  'اختيار الولاية لا يمنح أي صلاحية. يتحقق الخادم من تكليفك بعد التعريف.',
                  'Le choix du territoire n’accorde aucun droit. Vos affectations sont vérifiées par le serveur à l’identification.',
                )}
              </span>
            </p>
            {mode !== 'demo' && (
              <p className="welcome-empty" role="status">
                {l(
                  'تسجيل الدخول التجريبي غير متاح. الربط الرسمي بالهوية الرقمية غير مفعّل.',
                  'La connexion de démonstration est désactivée. L’intégration officielle e-Houwiya n’est pas configurée.',
                )}
              </p>
            )}
          </section>
        </div>
      </main>
      <EntryFooter />
    </div>
  );
}

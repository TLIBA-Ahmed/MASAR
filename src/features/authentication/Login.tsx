import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { useLocale } from '../../i18n';
import { useAppStore } from '../../stores/app';
import { brand } from '../../config/brand';
import { stages } from '../../config/workflow';
import { Button, Badge, Field, useToast } from '../../components/ui';
import { LanguageSwitch } from '../../components/layout/Shell';
import { InstitutionalLogo } from '../../components/layout/InstitutionalLogo';
import { ApiError } from '../../services/api';
import { governorates, readWorkplace } from './entryContext';
import type { DemoProfessional, EntryCentre } from './entryContext';
import { useEntryResource } from './useEntryResource';
import './welcome.css';
export function Login() {
  const { l, b, lang, t } = useLocale();
  const { signIn, error, retry, identityMode } = useAppStore();
  const [workplace] = useState(readWorkplace);
  const [profile, setProfile] = useState(''),
    [loginError, setLoginError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const centres = useEntryResource<EntryCentre[]>(
    workplace ? `/entry/governorates/${workplace.governorateId}/centres` : null,
  );
  const profiles = useEntryResource<DemoProfessional[]>(
    workplace && identityMode === 'demo'
      ? `/auth/demo/professionals?governorate_id=${workplace.governorateId}&centre_id=${encodeURIComponent(workplace.centreId)}`
      : null,
  );
  const governorate = governorates.find((g) => g.id === workplace?.governorateId);
  const centre = centres.data?.find((c) => c.id === workplace?.centreId);
  const availableProfiles = profiles.data ?? [];
  const selectedProfile = availableProfiles.some((p) => p.id === profile)
    ? profile
    : (availableProfiles[0]?.id ?? '');
  const toast = useToast();
  if (!workplace?.centreId || !governorate) return <Navigate to="/" replace />;
  return (
    <div className="login-page">
      <div className="login-form-panel">
        <div className="login-top">
          <Link className="brand dark" to="/">
            <img src={brand.logo} alt="" />
            <strong>
              مسار <span>MASAR</span>
            </strong>
          </Link>
          <LanguageSwitch />
        </div>
        <div className="login-content">
          <InstitutionalLogo className="login-institutional-logo" />
          <Badge tone="green" dot>
            {l('التكنولوجيا في خدمة الإنسان', 'La technologie au service de l’humain')}
          </Badge>
          <div className="login-icon">
            <Fingerprint size={35} />
          </div>
          <h1>
            {l('كل طفل يستحق', 'Chaque enfant mérite')}
            <br />
            <span>{l('مساراً أفضل.', 'un meilleur parcours.')}</span>
          </h1>
          <p>
            {b(brand.title)}.<br />
            {b(brand.slogan)}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedProfile || !centre) return;
              setLoginError(null);
              setBusy(true);
              void signIn(selectedProfile, workplace).catch((err: unknown) => {
                setLoginError(err instanceof ApiError ? err.code : 'ENTRY_UNAVAILABLE');
                toast(
                  l('تعذّر فتح الجلسة التجريبية.', 'Impossible d’ouvrir la session de démo.'),
                  true,
                );
                setBusy(false);
              });
            }}
          >
            <div className="login-workplace">
              <MapPin size={20} />
              <div>
                <small>{l('الولاية المختارة', 'Gouvernorat sélectionné')}</small>
                <strong>{b(governorate.name)}</strong>
                <p>{centre ? b(centre.name) : l('التحقق من المركز…', 'Vérification du centre…')}</p>
                {centre?.isDemo && (
                  <p>
                    {l(
                      'مركز تجريبي · بيانات اصطناعية',
                      'Centre de démonstration · Données synthétiques',
                    )}
                  </p>
                )}
                <Link to="/">{l('تغيير الولاية', 'Changer de gouvernorat')}</Link>
              </div>
            </div>
            {loginError && (
              <div className="welcome-entry-error" role="alert">
                {loginError === 'WORKPLACE_MISMATCH'
                  ? l(
                      'الولاية أو المركز لا يطابقان تكليفك النشط. غيّر الولاية أو المركز ثم أعد المحاولة.',
                      'Le gouvernorat ou le centre ne correspond pas à vos affectations actives. Changez de gouvernorat ou de centre puis réessayez.',
                    )
                  : loginError === 'INVALID_IDENTITY'
                    ? l(
                        'الملف المهني غير متاح أو لم يعد نشطاً.',
                        'Le profil professionnel n’est pas disponible ou n’est plus actif.',
                      )
                    : l(
                        'تعذر فتح الجلسة. تحقق من توفر الخادم ثم أعد المحاولة.',
                        'Impossible d’ouvrir la session. Vérifiez la disponibilité du serveur puis réessayez.',
                      )}
                <br />
                <Link to="/">{l('تغيير الولاية', 'Changer de gouvernorat')}</Link>
              </div>
            )}
            {(profiles.error || centres.error || (error && !loginError)) && (
              <div className="api-error" role="alert">
                {l(
                  'تعذر تحميل سجل الدخول. حاول مجدداً.',
                  'Impossible de charger le registre de connexion. Réessayez.',
                )}{' '}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    profiles.retry();
                    centres.retry();
                    if (error) void retry();
                  }}
                >
                  {l('إعادة المحاولة', 'Réessayer')}
                </Button>
              </div>
            )}
            <Field label={l('اختر هوية مهنية تجريبية', 'Choisir un profil professionnel fictif')}>
              <select
                value={selectedProfile}
                disabled={!availableProfiles.length || busy}
                onChange={(e) => setProfile(e.target.value)}
              >
                {!availableProfiles.length && (
                  <option value="">
                    {profiles.loading
                      ? l('تحميل الملفات…', 'Chargement des profils…')
                      : l('لا يوجد ملف متاح', 'Aucun profil disponible')}
                  </option>
                )}
                {availableProfiles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {b(p.name)} — {t(p.role)}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="submit"
              className="login-submit"
              disabled={
                busy ||
                !selectedProfile ||
                !centre ||
                identityMode !== 'demo' ||
                profiles.error ||
                centres.error
              }
            >
              <Fingerprint size={21} />
              {busy
                ? l('جارٍ فتح مساحة العمل…', 'Ouverture de votre espace…')
                : l('تسجيل الدخول بواسطة الهوية الرقمية', 'S’identifier avec e-Houwiya')}
              {lang === 'ar' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </Button>
          </form>
          <div className="login-disclaimer">
            <ShieldCheck size={19} />
            <span>
              {l(
                'هوية تجريبية يحلّها الخادم. تكامل e-Houwiya الرسمي غير متصل. جميع البيانات اصطناعية.',
                'Identité de démonstration résolue par le backend. L’intégration officielle e-Houwiya est déconnectée. Données synthétiques uniquement.',
              )}
            </span>
          </div>
          <div className="login-center">
            <span className="live-dot" />
            {centre ? b(centre.name) : b(governorate.name)}
            <span>·</span>
            {l('فضاء تجريبي', 'Espace de démonstration')}
          </div>
        </div>
        <footer>
          {t('demo')}
          <span>© 2026 MASAR</span>
        </footer>
      </div>
      <div className="login-art">
        <div className="art-grid" />
        <div className="art-top">
          <span>MASAR / SOCIAL CARE</span>
          <LockKeyhole size={18} />
        </div>
        <div className="art-heading">
          <span className="eyebrow">
            {l('نرافق اليوم، لنبني الغد', 'Accompagner aujourd’hui, construire demain')}
          </span>
          <h2>
            {l('رؤية واحدة.', 'Une vision commune.')}
            <br />
            {l('رحلة متكاملة.', 'Un parcours continu.')}
          </h2>
          <p>
            {l(
              'من أول لقاء إلى الإدماج، تبقى المعلومة متصلة ويبقى الإنسان في قلب المسار.',
              'Du premier entretien à l’intégration, l’information reste continue et l’humain au cœur du parcours.',
            )}
          </p>
        </div>
        <div className="journey-art">
          <div className="art-path" />
          {stages.map((s, i) => (
            <div key={s.id} className={`art-stage art-stage-${i}`}>
              <span style={{ background: s.color }}>
                {s.id === 3 ? <Sparkles size={23} /> : String(s.id).padStart(2, '0')}
              </span>
              <div>
                <small>
                  {l('المرحلة', 'Étape')} {s.id}
                </small>
                <strong>{b(s.short)}</strong>
              </div>
              {i < 2 && <ShieldCheck size={16} />}
            </div>
          ))}
        </div>
        <div className="art-bottom">
          <div className="art-avatars">
            <span>أ</span>
            <span>ن</span>
            <span>خ</span>
          </div>
          <p>
            {l(
              'فريق متعدد الاختصاصات. أثر إنساني مشترك.',
              'Une équipe pluridisciplinaire. Un impact humain partagé.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

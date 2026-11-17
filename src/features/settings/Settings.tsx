import { useEffect, useState } from 'react';
import { Database, Download, ShieldCheck, Cpu, Globe2 } from 'lucide-react';
import { useLocale } from '../../i18n';
import { api } from '../../services/api';
import { Badge, Button, Field, PageHeading, Panel, useAction } from '../../components/ui';
interface Status {
  mode: string;
  device: string;
  models: Record<string, { status: string; revision?: string }>;
  external_fallback: boolean;
}
export function Settings() {
  const run = useAction();
  const { l, lang, setLanguage, t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  useEffect(() => {
    void api<Status>('/ai/status')
      .then(setStatus)
      .catch(() => setStatusError(true));
  }, []);
  return (
    <>
      <PageHeading
        title={t('settings')}
        description={l(
          'تفضيلات العرض وحالة الخدمات المحلية.',
          'Préférences d’affichage et état des services locaux.',
        )}
      />
      <div className="settings-grid">
        <Panel className="settings-card">
          <div className="settings-card-title">
            <Globe2 size={24} />
            <h2>{l('الواجهة', 'Interface')}</h2>
          </div>
          <Field label={l('اللغة', 'Langue')}>
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value === 'ar' ? 'ar' : 'fr')}
            >
              <option value="ar">العربية — RTL</option>
              <option value="fr">Français — LTR</option>
            </select>
          </Field>
        </Panel>
        <Panel className="settings-card">
          <div className="settings-card-title">
            <Database size={24} />
            <h2>{l('قاعدة مسار المحلية', 'Base MASAR locale')}</h2>
          </div>
          <Badge tone="green">PostgreSQL · RLS</Badge>
          <p>
            {l(
              'الخادم هو مصدر البيانات والصلاحيات. يحتفظ المتصفح بتفضيلات الواجهة فقط؛ تم إبطال مخبأ التطبيق القديم لحماية الهوية.',
              'Le backend fait autorité pour les données et les accès. Le navigateur conserve les préférences d’interface ; l’ancien cache applicatif est invalidé pour protéger les identités.',
            )}
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void run(async () => {
                const data = await api('/exports/workspace');
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'MASAR-export-synthetique-autorise.json';
                a.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            <Download size={15} />
            {l('تصدير النطاق الاصطناعي المسموح', 'Exporter le périmètre synthétique autorisé')}
          </Button>
        </Panel>
        <Panel className="settings-card">
          <div className="settings-card-title">
            <Cpu size={24} />
            <h2>{l('النماذج المحلية', 'Modèles locaux')}</h2>
          </div>
          <Badge tone={status?.mode === 'local' ? 'green' : 'orange'}>
            {status?.mode === 'local'
              ? l('استدلال محلي على CPU', 'Inférence locale sur CPU')
              : status?.mode === 'demo'
                ? l('عرض حتمي دون استدلال', 'Démo déterministe sans inférence')
                : statusError
                  ? l('حالة الخدمة غير متاحة', 'État du service indisponible')
                  : l('جارٍ التحقق من الحالة', 'Vérification de l’état')}
          </Badge>
          <p>
            {l(
              'لا يوجد بديل سحابي تلقائي. الموارد والنتائج تظل استشارية.',
              'Aucun relais automatique vers le cloud. Les ressources et résultats restent consultatifs.',
            )}
          </p>
          {status &&
            Object.entries(status.models).map(([name, model]) => (
              <p className="backend-status" key={name}>
                {name} ·{' '}
                {model.status === 'tested-cpu'
                  ? l('اختُبر على CPU', 'Testé sur CPU')
                  : model.status === 'missing'
                    ? l('غير مثبت', 'Non installé')
                    : l('غير متاح — يتطلب التحقق', 'Indisponible — à vérifier')}{' '}
                {model.revision?.slice(0, 10)}
              </p>
            ))}
        </Panel>
        <Panel className="settings-card">
          <div className="settings-card-title">
            <ShieldCheck size={24} />
            <h2>{l('حدود النموذج التجريبي', 'Limites du PoC')}</h2>
          </div>
          <p>
            {l(
              'هويات وبيانات اصطناعية. تكامل e-Houwiya غير متصل. المنتدى محلي والمراحل المتقدمة مستقبلية. لا يُعد هذا اعتماداً لمعالجة ملفات حقيقية.',
              'Identités et données synthétiques. e-Houwiya déconnecté. Forum local et étapes avancées futures. Ce PoC ne constitue pas une autorisation de traiter des dossiers réels.',
            )}
          </p>
        </Panel>
      </div>
    </>
  );
}

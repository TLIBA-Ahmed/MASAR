import { useState } from 'react';
import {
  ArrowLeftRight,
  Database,
  Download,
  Globe2,
  HardDrive,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { requireCase } from '../../services/auth';
import { recordEvent } from '../../services/actions';
import { uid } from '../../utils/date';
import { bi } from '../../types';
import { brand } from '../../config/brand';
import {
  Badge,
  Button,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  SectionHeading,
  useAction,
  useToast,
} from '../../components/ui';
export function Settings() {
  const { l, b, t, lang, setLanguage } = useLocale();
  const { data, cases, session, mutate, reset, storage } = useWorkspace();
  const [confirm, setConfirm] = useState(false),
    [resetting, setResetting] = useState(false),
    [transfer, setTransfer] = useState(false),
    [selected, setSelected] = useState('CDIS-024'),
    [center, setCenter] = useState('gabes'),
    [reason, setReason] = useState('');
  const toast = useToast();
  const run = useAction();
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `masar-donnees-synthetiques-${data.demoDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeading
        title={t('settings')}
        description={l(
          'تفضيلات مساحة العمل وإدارة بيانات التجربة.',
          'Préférences de travail et gestion du jeu de démonstration.',
        )}
      />
      <div className="settings-grid">
        <Panel className="settings-card">
          <div className="settings-card-title">
            <span className="soft-icon">
              <Globe2 size={22} />
            </span>
            <div>
              <h2>{l('اللغة والاتجاه', 'Langue et direction')}</h2>
              <p>
                {l(
                  'يتغير الاتجاه دون فقدان الإدخالات.',
                  'La direction change sans perdre votre saisie.',
                )}
              </p>
            </div>
          </div>
          <Field label={l('لغة الواجهة', 'Langue de l’interface')}>
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value === 'ar' ? 'ar' : 'fr')}
            >
              <option value="ar">العربية — RTL</option>
              <option value="fr">Français — LTR</option>
            </select>
          </Field>
          <p>{b(brand.slogan)}</p>
        </Panel>
        <Panel className="settings-card">
          <div className="settings-card-title">
            <span className="soft-icon">
              <HardDrive size={22} />
            </span>
            <div>
              <h2>{l('التخزين المحلي', 'Stockage local')}</h2>
              <p>IndexedDB · {l('هذا المتصفح فقط', 'Ce navigateur uniquement')}</p>
            </div>
          </div>
          <Badge tone={storage === 'error' ? 'red' : 'green'}>
            {storage === 'error'
              ? l('خطأ في الحفظ', 'Erreur de sauvegarde')
              : l('بيانات التجربة محفوظة محلياً', 'Données de démo conservées localement')}
          </Badge>
          <p>
            {l(
              'ليس تخزيناً ملائماً لملفات حقيقية تخص القُصّر. التصدير يخص البيانات الاصطناعية فقط.',
              'Ce stockage ne convient pas aux dossiers réels de mineurs. L’export concerne uniquement les données synthétiques.',
            )}
          </p>
          <Button variant="secondary" onClick={exportData}>
            <Download size={16} />
            {l('تصدير بيانات التجربة', 'Exporter les données synthétiques')}
          </Button>
        </Panel>
        <Panel className="settings-card">
          <div className="settings-card-title">
            <span className="soft-icon">
              <Database size={22} />
            </span>
            <div>
              <h2>{l('إعادة تهيئة العرض', 'Réinitialiser la démonstration')}</h2>
              <p>{l('40 ملفاً و30 نشاطاً اصطناعياً', '40 dossiers et 30 activités synthétiques')}</p>
            </div>
          </div>
          <p>
            {l(
              'يستبدل هذا الإجراء التعديلات المحلية ببيانات البداية. يُطلب التأكيد أولاً.',
              'Cette action remplace les modifications locales par le jeu initial, après confirmation.',
            )}
          </p>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            <RotateCcw size={16} />
            {l('إعادة التهيئة', 'Réinitialiser')}
          </Button>
        </Panel>
        <Panel className="settings-card">
          <div className="settings-card-title">
            <span className="soft-icon">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h2>{l('حدود النموذج التجريبي', 'Limites du prototype')}</h2>
              <p>{t('demo')}</p>
            </div>
          </div>
          <p>
            {l(
              'هوية وصلاحيات ومصادقات ورسائل محاكية. لا اتصال بالخدمات الحكومية أو بمحرك ذكاء اصطناعي خارجي.',
              'Identité, autorisations, validations et messages simulés. Aucune connexion aux services gouvernementaux ni à un modèle d’IA externe.',
            )}
          </p>
          <Badge>{l('دون بيانات حقيقية', 'Sans données réelles')}</Badge>
        </Panel>
      </div>
      <Panel className="transfer-panel">
        <SectionHeading
          title={l('استمرارية التعهد بين المراكز', 'Continuité entre centres')}
          subtitle={l(
            'طلب تحويل مع تأكيد إداري صريح، وحفظ التاريخ كاملاً.',
            'Demande de transfert avec confirmation administrative et historique conservé.',
          )}
          actions={
            <Button variant="secondary" onClick={() => setTransfer(true)}>
              <ArrowLeftRight size={16} />
              {l('تحويل تجريبي', 'Simuler un transfert')}
            </Button>
          }
        />
        <div className="transfer-list">
          {data.transfers
            .filter(
              (tr) => tr.fromCenter === session!.centerId || tr.toCenter === session!.centerId,
            )
            .map((tr) => (
              <div key={tr.id}>
                <span>
                  <strong>{tr.caseId}</strong>
                  <small>
                    {b(data.centers.find((c) => c.id === tr.fromCenter)!.name)} ←{' '}
                    {b(data.centers.find((c) => c.id === tr.toCenter)!.name)}
                  </small>
                  <p className="narrative">{tr.reason}</p>
                </span>
                <Badge tone={tr.status === 'confirmed' ? 'green' : 'orange'}>
                  {tr.status === 'confirmed'
                    ? l('تم التحويل', 'Transfert confirmé')
                    : l('في انتظار التأكيد', 'En attente de confirmation')}
                </Badge>
                {tr.status === 'requested' && session?.role === 'administration' && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run(() =>
                        mutate((d, s) => {
                          const record = d.transfers.find((x) => x.id === tr.id)!;
                          if (record.status === 'confirmed') return;
                          const c = requireCase(d, s, tr.caseId);
                          record.status = 'confirmed';
                          recordEvent(
                            d,
                            c,
                            s,
                            'transfer',
                            bi(
                              'تأكيد التحويل التجريبي بين المراكز',
                              'Transfert simulé entre centres confirmé',
                            ),
                            record.reason,
                            record.id,
                          );
                          c.centerId = record.toCenter;
                          d.professionals
                            .filter((p) => p.centerId === c.centerId)
                            .forEach((p) => {
                              if (
                                !d.assignments.some(
                                  (a) => a.caseId === c.id && a.professionalId === p.id,
                                )
                              )
                                d.assignments.push({ caseId: c.id, professionalId: p.id });
                            });
                        }),
                      )
                    }
                  >
                    {l('تأكيد التحويل البشري', 'Confirmer le transfert')}
                  </Button>
                )}
              </div>
            ))}
          {!data.transfers.length && (
            <p className="muted">
              {l('لم يُسجّل أي طلب تحويل.', 'Aucune demande de transfert enregistrée.')}
            </p>
          )}
        </div>
      </Panel>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={l('إعادة بيانات البداية؟', 'Restaurer le jeu initial ?')}
        description={l(
          'سيتم استبدال جميع التعديلات المحلية. صدّر نسخة قبل المتابعة إن احتجت إليها.',
          'Toutes les modifications locales seront remplacées. Exportez une copie si vous souhaitez la conserver.',
        )}
      >
        <div className="dialog-body">
          <Info tone="orange">
            {l(
              'يشمل ذلك الملفات الجديدة والمسودات والرسائل والقرارات والحصص المضافة.',
              'Cela inclut les nouveaux dossiers, brouillons, messages, décisions et séances ajoutés.',
            )}
          </Info>
        </div>
        <div className="dialog-footer">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={resetting}
            onClick={() => {
              setResetting(true);
              void reset()
                .then(() => {
                  localStorage.removeItem('masar.new-case');
                  setConfirm(false);
                  toast(
                    l(
                      'استُعيدت البيانات الاصطناعية الأصلية.',
                      'Le jeu synthétique initial a été restauré.',
                    ),
                  );
                })
                .catch(() =>
                  toast(l('تعذّرت إعادة التهيئة.', 'La réinitialisation a échoué.'), true),
                )
                .finally(() => setResetting(false));
            }}
          >
            {resetting
              ? l('جارٍ الاستعادة…', 'Restauration…')
              : l('تأكيد الاستعادة', 'Confirmer la restauration')}
          </Button>
        </div>
      </Modal>
      <Modal
        open={transfer}
        onClose={() => setTransfer(false)}
        title={l('طلب تحويل تجريبي', 'Demande de transfert simulé')}
        description={l(
          'الطلب لا يغيّر المركز قبل تأكيد الإدارة.',
          'Le centre ne change pas avant confirmation administrative.',
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const result = run(() => {
              mutate((d, s) => {
                const c = requireCase(d, s, selected);
                if (
                  c.centerId === center ||
                  !reason.trim() ||
                  d.transfers.some((tr) => tr.caseId === c.id && tr.status === 'requested')
                )
                  throw Error('VALIDATION');
                d.transfers.push({
                  id: uid('transfer'),
                  caseId: c.id,
                  fromCenter: c.centerId,
                  toCenter: center,
                  date: d.demoDate,
                  reason,
                  status: 'requested',
                  professionalId: s.professionalId,
                });
                recordEvent(
                  d,
                  c,
                  s,
                  'transfer',
                  bi('طلب تحويل تجريبي', 'Demande de transfert simulé'),
                  reason,
                );
              });
              return true;
            });
            if (result) {
              setTransfer(false);
              setReason('');
            }
          }}
        >
          <div className="dialog-body">
            <Field label={l('الملف المعني', 'Dossier concerné')}>
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {cases
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.id}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={l('المركز المستقبِل التجريبي', 'Centre destinataire (démo)')}>
              <select value={center} onChange={(e) => setCenter(e.target.value)}>
                {data.centers
                  .filter((c) => c.id !== session!.centerId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {b(c.name)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={l('سبب التحويل', 'Motif')} required>
              <textarea required value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <div className="dialog-footer">
            <Button variant="secondary" type="button" onClick={() => setTransfer(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{l('حفظ الطلب', 'Enregistrer la demande')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

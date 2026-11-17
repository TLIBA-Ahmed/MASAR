import * as D from '@radix-ui/react-dialog';
import { createContext, useContext, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, ChevronLeft, CircleAlert, Inbox, X, UserRound } from 'lucide-react';
import { useLocale } from '../../i18n';
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" title={label} aria-label={label} className="icon-button" {...props}>
      {children}
    </button>
  );
}
export function Panel({
  children,
  className = '',
  ...props
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function SectionHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'orange' | 'blue' | 'purple' | 'red';
  dot?: boolean;
}) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}
export function Avatar({
  name,
  size = 'md',
  color = 0,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  color?: number;
}) {
  const initials = name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  return (
    <span aria-hidden="true" className={`avatar ${size} color-${color % 5}`}>
      {/^(CDIS-\d+|CH-[A-F0-9]+)$/.test(name) ? (
        <UserRound size={size === 'lg' ? 27 : 18} />
      ) : (
        initials
      )}
    </span>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { l } = useLocale();
  return (
    <D.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content
          className={`dialog-content ${wide ? 'wide' : ''}`}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          <div className="dialog-header">
            <div>
              <D.Title>{title}</D.Title>
              {description && <D.Description id="modal-description">{description}</D.Description>}
            </div>
            <D.Close asChild>
              <IconButton label={l('إغلاق', 'Fermer')}>
                <X size={19} />
              </IconButton>
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={28} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Info({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'orange' | 'green';
}) {
  return (
    <div className={`info-box ${tone}`}>
      <CircleAlert size={17} />
      <div>{children}</div>
    </div>
  );
}
export function BackArrow() {
  return <ChevronLeft className="direction-arrow" size={16} />;
}
export function Field({
  label,
  children,
  required = false,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className={`field ${error ? 'invalid' : ''}`}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
      {error && <small className="error-text">{error}</small>}
    </label>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; error: boolean }[]>([]);
  function notify(message: string, error = false) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, error }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div role="status" className={`toast ${toast.error ? 'error' : ''}`} key={toast.id}>
            {toast.error ? <CircleAlert size={19} /> : <Check size={19} />}
            <span>{toast.message}</span>
            <button
              aria-label="×"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function useAction() {
  const toast = useToast();
  const { l, t } = useLocale();
  const errors: Record<string, string> = {
    ACCESS: l(
      'هذا الملف خارج نطاق الجلسة التجريبية.',
      'Ce dossier est hors du périmètre de la session.',
    ),
    STALE_RECOMMENDATION: l(
      'تغيّر السياق أو الأهداف. أعد توليد التوصيات قبل اعتمادها.',
      'Le contexte ou les objectifs ont changé. Régénérez les recommandations avant validation.',
    ),
    ADMIN_ONLY: l(
      'استخدم ملف الإدارة التجريبي لتوثيق هذا القرار.',
      'Sélectionnez le profil Administration pour cette décision.',
    ),
    SOCIAL_ONLY: l(
      'يفتح الأخصائي الاجتماعي الملفات الجديدة.',
      'Les nouveaux dossiers sont ouverts par le travailleur social.',
    ),
    REASON: l('يرجى توثيق سبب القرار.', 'Veuillez motiver la décision.'),
    SUPERVISION: l(
      'يلزم توثيق الإشراف الإداري على المشروع أولاً.',
      'Documentez d’abord la supervision administrative du projet.',
    ),
    PARTICIPANTS: l(
      'تحقق من عدد المشاركين وأعمارهم ونطاق ملفاتهم.',
      'Vérifiez l’effectif, les âges et le périmètre des participants.',
    ),
    GOALS: l(
      'أكد الأهداف التربوية قبل البرمجة.',
      'Confirmez les objectifs pédagogiques avant la programmation.',
    ),
    DATE: l(
      'اختر تاريخاً من تاريخ العرض أو بعده ووقتاً صحيحاً.',
      'Choisissez une date à partir de la date de démo et une heure valide.',
    ),
    VALIDATION: l(
      'راجع الحقول المطلوبة والقيم المدخلة.',
      'Vérifiez les champs requis et les valeurs saisies.',
    ),
    INACTIVE: l(
      'الملف مختوم أو مؤرشف؛ السجل متاح للقراءة.',
      'Ce dossier est clôturé ou archivé ; son historique reste consultable.',
    ),
    INTEGRATION_REQUIRED: l(
      'وثّق نتائج الإدماج أو اكتب [N/A] مع تفسير عدم انطباقه.',
      'Documentez les résultats d’intégration ou indiquez [N/A] et son motif.',
    ),
    OBSERVATION: l(
      'أضف ملاحظة لكل مشارك حاضر.',
      'Ajoutez une observation pour chaque participant présent.',
    ),
    TRANSITION: l(
      'هذا القرار غير متاح في المرحلة الحالية.',
      'Cette décision ne correspond pas à l’étape actuelle.',
    ),
  };
  return <T,>(fn: () => T, message = t('saved')): T | undefined => {
    try {
      const result = fn();
      if (result instanceof Promise)
        return result
          .then((value) => {
            toast(message);
            return value;
          })
          .catch(() => {
            toast(
              l(
                'رفض الخادم العملية أو تغيّرت صلاحيات الوصول. حدّث البيانات.',
                'Le serveur a refusé l’opération ou les accès ont changé. Actualisez les données.',
              ),
              true,
            );
            return undefined;
          }) as T;
      toast(message);
      return result;
    } catch (error) {
      toast(
        errors[error instanceof Error ? error.message : ''] ??
          l(
            'تعذّر تنفيذ العملية. راجع البيانات وحاول مجدداً.',
            'L’opération a échoué. Vérifiez les données et réessayez.',
          ),
        true,
      );
      return undefined;
    }
  };
}

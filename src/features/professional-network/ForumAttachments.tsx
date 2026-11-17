import { useId, useState } from 'react';
import { Download, FileText, Paperclip, X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useToast } from '../../components/ui';
import { ApiError } from '../../services/api';
import type { ForumAttachment, Language } from '../../types';

export const forumMaxBytes = 8 * 1024 * 1024;
export const forumMaxFiles = 3;
export function forumFileError(code: string, lang: Language) {
  const messages: Record<string, [string, string]> = {
    FORUM_ATTACHMENT_SIZE: [
      'الحد الأقصى للوثائق هو 8 ميغابايت لكل إرسال.',
      'Les documents sont limités à 8 Mo au total par envoi.',
    ],
    FORUM_ATTACHMENT_COUNT: [
      'يمكن إرفاق ثلاث وثائق كحد أقصى.',
      'Vous pouvez joindre trois documents au maximum.',
    ],
    FORUM_ATTACHMENT_FORMAT: [
      'الأنواع المقبولة: PDF نصي وWord DOCX وTXT.',
      'Formats acceptés : PDF contenant du texte, Word DOCX et TXT.',
    ],
    FORUM_ATTACHMENT_TEXT_REQUIRED: [
      'تتطلب الوثيقة نصاً قابلاً للقراءة؛ الملفات المصوّرة دون نص غير مدعومة.',
      'Le document doit contenir du texte lisible ; les scans sans texte ne sont pas pris en charge.',
    ],
    FORUM_ATTACHMENT_PRIVACY: [
      'تحتوي الوثيقة أو تسميتها على معلومات تعريفية معروفة. استخدم مورداً عاماً دون بيانات شخصية.',
      'Le document ou son nom contient des identifiants personnels connus. Utilisez une ressource générale sans données personnelles.',
    ],
    FORUM_ATTACHMENT_INVALID: [
      'تعذرت قراءة الوثيقة أو تتضمن محتوى نشطاً غير مسموح.',
      'Document illisible ou contenant des éléments actifs non autorisés.',
    ],
  };
  return (
    messages[code]?.[lang === 'ar' ? 0 : 1] ??
    (lang === 'ar'
      ? 'الوثيقة غير متاحة ضمن صلاحياتك الحالية.'
      : 'Ce document n’est pas disponible avec vos droits actuels.')
  );
}

export function ForumAttachmentPicker({
  files,
  onChange,
  disabled = false,
  label,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { l, lang } = useLocale();
  const toast = useToast();
  const id = useId();
  return (
    <div className="forum-attachment-picker">
      <label
        className={`button secondary forum-file-button ${disabled ? 'disabled' : ''}`}
        htmlFor={id}
      >
        <Paperclip size={15} />
        {label ?? l('إرفاق وثيقة', 'Joindre un document')}
      </label>
      <input
        id={id}
        className="forum-file-input"
        type="file"
        multiple
        disabled={disabled}
        accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label={label ?? l('إرفاق وثيقة', 'Joindre un document')}
        aria-describedby={`${id}-help`}
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          e.target.value = '';
          const next = [...files];
          for (const file of selected)
            if (
              !next.some(
                (f) =>
                  f.name === file.name &&
                  f.size === file.size &&
                  f.lastModified === file.lastModified,
              )
            )
              next.push(file);
          const code =
            next.length > forumMaxFiles
              ? 'FORUM_ATTACHMENT_COUNT'
              : next.reduce((n, f) => n + f.size, 0) > forumMaxBytes
                ? 'FORUM_ATTACHMENT_SIZE'
                : next.some((f) => !/\.(pdf|docx|txt)$/i.test(f.name))
                  ? 'FORUM_ATTACHMENT_FORMAT'
                  : null;
          if (code) toast(forumFileError(code, lang), true);
          else onChange(next);
        }}
      />
      <small id={`${id}-help`}>
        {l(
          'PDF نصي، DOCX، TXT · 3 وثائق و8 ميغابايت كحد أقصى · موارد عامة فقط.',
          'PDF texte, DOCX, TXT · 3 documents, 8 Mo au total · Ressources générales uniquement.',
        )}
      </small>
      {files.length > 0 && (
        <ul className="forum-selected-files">
          {files.map((file, index) => (
            <li key={`${file.name}:${file.lastModified}`}>
              <FileText size={16} />
              <span dir="auto">{file.name}</span>
              <small>
                {new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', {
                  maximumFractionDigits: 1,
                }).format(file.size / 1024)}{' '}
                {l('ك.ب', 'Ko')}
              </small>
              <button
                type="button"
                disabled={disabled}
                aria-label={`${l('إزالة', 'Retirer')} ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ForumAttachments({ files = [] }: { files?: ForumAttachment[] }) {
  const { l, lang } = useLocale();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  if (!files.length) return null;
  async function download(file: ForumAttachment) {
    setPending(file.id);
    try {
      const response = await fetch(
        `/api/v1/forum/attachments/${encodeURIComponent(file.id)}/download`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!response.ok) {
        const value = (await response.json()) as { detail?: { code?: string } };
        throw new ApiError(response.status, value.detail?.code ?? 'RESOURCE_UNAVAILABLE');
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast(
        forumFileError(error instanceof ApiError ? error.code : 'RESOURCE_UNAVAILABLE', lang),
        true,
      );
    } finally {
      setPending(null);
    }
  }
  return (
    <ul className="forum-attachment-list" aria-label={l('الوثائق المرفقة', 'Documents joints')}>
      {files.map((file) => (
        <li key={file.id}>
          <FileText size={20} />
          <div>
            <strong dir="auto">{file.name}</strong>
            <small>
              {new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', {
                maximumFractionDigits: 1,
              }).format(file.size / 1024)}{' '}
              {l('ك.ب', 'Ko')} ·{' '}
              {file.mediaType === 'application/pdf'
                ? 'PDF'
                : file.mediaType === 'text/plain'
                  ? 'TXT'
                  : 'DOCX'}
            </small>
          </div>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void download(file)}
            aria-label={`${l('تنزيل', 'Télécharger')} ${file.name}`}
          >
            <Download size={16} />
            {pending === file.id ? l('جار التحقق…', 'Vérification…') : l('تنزيل', 'Télécharger')}
          </button>
        </li>
      ))}
    </ul>
  );
}

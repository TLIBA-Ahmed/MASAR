import { brand } from '../../config/brand';
import { useLocale } from '../../i18n';
import './institutional-logo.css';

export function InstitutionalLogo({ className = '' }: { className?: string }) {
  const { l } = useLocale();
  return (
    <div className={`institutional-logo ${className}`} dir="ltr">
      <img
        src={brand.institutionalLogo}
        width={716}
        height={428}
        alt={l(
          'الجمهورية التونسية — وزارة الشؤون الاجتماعية',
          'République tunisienne — Ministère des Affaires sociales',
        )}
      />
    </div>
  );
}

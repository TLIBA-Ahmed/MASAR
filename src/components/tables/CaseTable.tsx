import { Link } from 'react-router-dom';
import { ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import type { AppData, Case } from '../../types';
import { useLocale } from '../../i18n';
import { stages } from '../../config/workflow';
import { Avatar, Badge, Empty } from '../ui';
import { ageAt } from '../../utils/date';
export function CaseTable({
  cases,
  data,
  compact = false,
}: {
  cases: Case[];
  data: AppData;
  compact?: boolean;
}) {
  const { l, b, t, date, lang } = useLocale();
  if (!cases.length)
    return (
      <Empty
        title={t('noResults')}
        description={l(
          'غيّر البحث أو الفلاتر لإظهار الملفات.',
          'Modifiez la recherche ou les filtres pour afficher des dossiers.',
        )}
      />
    );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{l('الطفل / الملف', 'Enfant / Dossier')}</th>
            {!compact && <th>{l('العمر', 'Âge')}</th>}
            <th>{l('مرحلة المسار', 'Étape du parcours')}</th>
            {!compact && <th>{l('المرجع المهني', 'Référent')}</th>}
            <th>{l('الموعد القادم', 'Échéance')}</th>
            <th>{l('الحالة', 'Statut')}</th>
            <th>
              <span className="sr-only">{t('open')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, i) => {
            const child = data.children.find((ch) => ch.id === c.childId)!;
            const professional = data.professionals.find((p) => p.id === c.referentId);
            const stage = stages[c.stage - 1];
            return (
              <tr key={c.id}>
                <td>
                  <Link to={`/cases/${c.id}`} className="person-cell">
                    <Avatar name={b(child.name)} color={i} />
                    <span>
                      <strong>{b(child.name)}</strong>
                      <small dir="ltr">
                        {c.id}
                        {c.id === 'CDIS-024' && <span className="demo-case-dot" />}
                      </small>
                    </span>
                  </Link>
                </td>
                {!compact && (
                  <td>
                    {child.birthDate
                      ? `${ageAt(child.birthDate, data.demoDate)} ${l('سنة', 'ans')}`
                      : l('هوية محمية', 'Identité protégée')}
                  </td>
                )}
                <td>
                  <span className="stage-label">
                    <i style={{ background: stage.color }} />
                    {b(stage.short)}
                  </span>
                </td>
                {!compact && <td>{professional ? b(professional.name) : '—'}</td>}
                <td>
                  <span
                    className={
                      c.nextDue < data.demoDate && c.status === 'active' ? 'due-overdue' : ''
                    }
                  >
                    {c.status === 'active'
                      ? date(c.nextDue, { day: 'numeric', month: 'short' })
                      : '—'}
                  </span>
                </td>
                <td>
                  <Badge dot tone={c.status === 'active' ? 'green' : 'neutral'}>
                    {t(c.status)}
                  </Badge>
                </td>
                <td>
                  <Link
                    className="icon-button"
                    to={`/cases/${c.id}`}
                    aria-label={`${t('open')} ${c.id}`}
                  >
                    {lang === 'ar' ? <ArrowUpLeft size={17} /> : <ArrowUpRight size={17} />}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

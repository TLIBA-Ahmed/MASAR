import { useNavigate } from 'react-router-dom';
import { useLocale } from '../../i18n';
import type { JourneyChild } from './types';

export function ChildJourneySelector({
  children,
  selected,
}: {
  children: JourneyChild[];
  selected: string;
}) {
  const { l, b } = useLocale();
  const navigate = useNavigate();
  return (
    <label className="journey-child-selector">
      <span>{l('اختيار ملف مصرح به', 'Choisir un dossier autorisé')}</span>
      <select
        value={selected}
        onChange={(e) => navigate(`/child-journey/${encodeURIComponent(e.target.value)}`)}
      >
        {!children.some((c) => c.id === selected) && <option value={selected}>{selected}</option>}
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} · {b(c.name)}
            {c.cycle > 1 ? ` · ${l('الدورة', 'Cycle')} ${c.cycle}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

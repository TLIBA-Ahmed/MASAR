import { Check } from 'lucide-react';
import { stages } from '../../config/workflow';
import type { Stage } from '../../types';
import { useLocale } from '../../i18n';
export function Stepper({
  current,
  selected,
  onSelect,
}: {
  current: Stage;
  selected: Stage;
  onSelect: (s: Stage) => void;
}) {
  const { b, l } = useLocale();
  return (
    <div className="journey-stepper" aria-label={l('مراحل مسار التعهد', 'Étapes du parcours')}>
      {stages.map((s) => (
        <button
          key={s.id}
          className={`${s.id === current ? 'current' : ''} ${s.id === selected ? 'selected' : ''} ${s.id < current ? 'done' : ''}`}
          aria-current={s.id === current ? 'step' : undefined}
          onClick={() => onSelect(s.id)}
          style={{ '--stage-color': s.color } as React.CSSProperties}
        >
          <span className="step-circle">{s.id < current ? <Check size={17} /> : s.id}</span>
          <span>
            <strong>{b(s.short)}</strong>
            <small>
              {s.id < current
                ? l('منجزة', 'Terminée')
                : s.id === current
                  ? l('المرحلة الحالية', 'Étape actuelle')
                  : l('مرحلة قادمة', 'À venir')}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { Check, Clock3, Circle, CircleDot, LockKeyhole } from 'lucide-react';
import { useLocale } from '../../i18n';
import { statusLabels } from './labels';
import { JourneyCheckpointTooltip } from './JourneyCheckpointTooltip';
import type { JourneyCheckpointData } from './types';
import type { Stage } from '../../types';

export function JourneyCheckpoint({
  checkpoint: s,
  selected,
  onSelect,
  position,
}: {
  checkpoint: JourneyCheckpointData;
  selected: boolean;
  onSelect: (id: Stage) => void;
  position: { x: number; y: number; visible: boolean };
}) {
  const { l, b } = useLocale();
  const [hover, setHover] = useState(false);
  const Icon =
    s.status === 'completed'
      ? Check
      : s.current
        ? CircleDot
        : s.status === 'pending'
          ? Clock3
          : s.future
            ? LockKeyhole
            : Circle;
  return (
    <div
      className={`journey-map-checkpoint state-${s.status} ${s.current ? 'is-current' : ''} ${selected ? 'is-selected' : ''} checkpoint-${s.id}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        visibility: position.visible ? 'visible' : 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        aria-pressed={selected}
        aria-label={`${l('المرحلة', 'Étape')} ${s.id} — ${b(s.title)}`}
        aria-describedby={hover ? `checkpoint-tip-${s.id}` : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <span className="checkpoint-dot">
          <Icon size={15} />
        </span>
        <span className="checkpoint-label">
          <small>
            0{s.id} ·{' '}
            {s.childCount !== undefined
              ? `${s.childCount} ${l('أطفال', 'enfants')}`
              : b(statusLabels[s.status])}
          </small>
          <strong>{b(s.short)}</strong>
          {s.future && <em>{l('مستقبلية', 'Future')}</em>}
        </span>
      </button>
      {hover && <JourneyCheckpointTooltip checkpoint={s} />}
    </div>
  );
}

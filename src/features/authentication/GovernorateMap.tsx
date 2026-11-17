import { useEffect, useId, useMemo, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useLocale } from '../../i18n';
import { governorates } from './entryContext';

type Point = number[];
interface Feature {
  properties: { shapeISO: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}
interface Geography {
  features: Feature[];
}
function polygons(f: Feature): Point[][][] {
  return (
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  ) as Point[][][];
}
export function GovernorateMap({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const { l, b } = useLocale();
  const [data, setData] = useState<Geography>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [hovered, setHovered] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/geography/tunisia-governorates.geojson', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error('GEOGRAPHY_UNAVAILABLE');
        const value = (await r.json()) as Geography;
        if (
          value.features.length !== 24 ||
          new Set(value.features.map((f) => f.properties.shapeISO)).size !== 24 ||
          value.features.some((f) => !governorates.some((g) => g.id === f.properties.shapeISO))
        )
          throw Error('GEOGRAPHY_INVALID');
        setData(value);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [revision]);
  const paths = useMemo(() => {
    if (!data) return [];
    const coordinates = data.features.flatMap((f) => polygons(f).flat(2));
    const xs = coordinates.map((p) => p[0] * Math.cos((34 * Math.PI) / 180));
    const ys = coordinates.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const scale = Math.min(480 / (maxX - minX), 650 / (maxY - minY));
    const project = (p: Point) => [
      (p[0] * Math.cos((34 * Math.PI) / 180) - (minX + maxX) / 2) * scale + 300,
      ((minY + maxY) / 2 - p[1]) * scale + 365,
    ];
    return data.features.map((f) => ({
      id: f.properties.shapeISO,
      d: polygons(f)
        .map((p) =>
          p
            .map(
              (ring) =>
                ring
                  .map(
                    (pt, i) =>
                      `${i ? 'L' : 'M'}${project(pt)
                        .map((v) => v.toFixed(2))
                        .join(',')}`,
                  )
                  .join('') + 'Z',
            )
            .join(''),
        )
        .join(''),
    }));
  }, [data]);
  const focus = governorates.find((g) => g.id === (hovered ?? selected));
  return (
    <div className="governorate-map" dir="ltr">
      <div className="map-compass" aria-hidden="true">
        <span>N</span>
        <i /> <small>تونس · TUNISIE</small>
      </div>
      <div className="map-sea" aria-hidden="true">
        {l('البحر الأبيض المتوسط', 'MER MÉDITERRANÉE')}
      </div>
      {!data && !error && (
        <p className="welcome-map-status" role="status">
          {l('تحميل الخريطة…', 'Chargement de la carte…')}
        </p>
      )}
      {error && (
        <div className="welcome-map-status" role="alert">
          <p>
            {l(
              'الخريطة غير متاحة. يمكنك استخدام القائمة.',
              'Carte indisponible. La liste reste utilisable.',
            )}
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() => setRevision((v) => v + 1)}
          >
            {l('إعادة المحاولة', 'Réessayer')}
          </button>
        </div>
      )}
      <svg
        className="governorate-svg"
        viewBox="0 0 600 740"
        aria-label={l(
          'خريطة ولايات تونس التفاعلية',
          'Carte interactive des gouvernorats de Tunisie',
        )}
      >
        <defs>
          <linearGradient id={`${id}-land`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#e8f0ec" />
            <stop offset="1" stopColor="#cbded8" />
          </linearGradient>
          <linearGradient id={`${id}-selected`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#419e85" />
            <stop offset="1" stopColor="#24765e" />
          </linearGradient>
          <filter id={`${id}-shadow`} x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="16"
              stdDeviation="13"
              floodColor="#123e53"
              floodOpacity=".16"
            />
          </filter>
        </defs>
        <g transform={`translate(300 370) scale(${zoom}) translate(-300 -370)`}>
          <g className="governorate-map-shadow" filter={`url(#${id}-shadow)`} aria-hidden="true">
            {paths.map((p) => (
              <path key={p.id} d={p.d} fill="#d4e3dc" />
            ))}
          </g>
          <g className="governorate-territories">
            {paths.map((p, i) => {
              const g = governorates.find((v) => v.id === p.id)!;
              return (
                <path
                  key={p.id}
                  d={p.d}
                  data-governorate={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={b(g.name)}
                  aria-pressed={selected === p.id}
                  fill={`url(#${id}-${selected === p.id ? 'selected' : 'land'})`}
                  className={selected === p.id ? 'selected' : ''}
                  onClick={() => onSelect(p.id)}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(undefined)}
                  onFocus={() => setHovered(p.id)}
                  onBlur={() => setHovered(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(p.id);
                    }
                    if (
                      ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(
                        e.key,
                      )
                    ) {
                      e.preventDefault();
                      const next =
                        e.key === 'Home'
                          ? 0
                          : e.key === 'End'
                            ? paths.length - 1
                            : (i +
                                (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) +
                                paths.length) %
                              paths.length;
                      const regions =
                        e.currentTarget.parentElement?.querySelectorAll<SVGPathElement>(
                          '[role="button"]',
                        );
                      regions?.[next]?.focus();
                    }
                  }}
                >
                  <title>
                    {g.name.ar} · {g.name.fr}
                  </title>
                </path>
              );
            })}
          </g>
        </g>
      </svg>
      <div
        className={`governorate-map-tooltip ${focus ? 'visible' : ''}`}
        aria-live="polite"
        dir="auto"
      >
        {focus ? (
          <>
            <strong lang="ar">{focus.name.ar}</strong>
            <span lang="fr">{focus.name.fr}</span>
          </>
        ) : (
          <span>{l('اختر ولايتك على الخريطة', 'Sélectionnez votre territoire')}</span>
        )}
      </div>
      <div className="governorate-map-tools">
        <button
          type="button"
          aria-label={l('تكبير الخريطة', 'Agrandir la carte')}
          disabled={zoom >= 1.3}
          onClick={() => setZoom((v) => Math.min(1.3, v + 0.15))}
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          aria-label={l('تصغير الخريطة', 'Réduire la carte')}
          disabled={zoom <= 1}
          onClick={() => setZoom((v) => Math.max(1, v - 0.15))}
        >
          <Minus size={17} />
        </button>
        <button
          type="button"
          aria-label={l('إعادة ضبط الخريطة', 'Réinitialiser la carte')}
          onClick={() => setZoom(1)}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}

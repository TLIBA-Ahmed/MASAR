import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Compass, Focus, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useLocale } from '../../i18n';
import { IconButton } from '../../components/ui';
import { JourneyCheckpoint } from './JourneyCheckpoint';
import { points, silhouettePath, svgPoint } from './mapGeometry';
import type { MapPositions, MapScene } from './TunisiaScene';
import type { JourneyCheckpointData } from './types';
import type { Stage } from '../../types';

const WebGL = lazy(() => import('./TunisiaWebGL'));
export function TunisiaMap3D({
  checkpoints,
  selected,
  onSelect,
  hasExtension = false,
  overview = false,
  onPositions,
}: {
  checkpoints: JourneyCheckpointData[];
  selected: Stage | null;
  onSelect: (id: Stage) => void;
  hasExtension?: boolean;
  overview?: boolean;
  onPositions?: (positions: MapPositions) => void;
}) {
  const { l, b } = useLocale();
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [unavailable, setUnavailable] = useState(false);
  const [positions, setPositions] = useState<MapPositions>({});
  const [zoom2d, setZoom2d] = useState(1);
  const [viewBoxWidth, setViewBoxWidth] = useState(1000);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MapScene | null>(null);
  const onReady = useCallback((value: MapScene | null) => {
    scene.current = value;
  }, []);
  const onProject = useCallback(
    (value: MapPositions) => {
      setPositions(value);
      onPositions?.(value);
    },
    [onPositions],
  );
  const onFailure = useCallback(() => {
    setUnavailable(true);
    setMode('2d');
  }, []);
  useEffect(() => {
    if (selected && mode === '3d') scene.current?.focus(selected);
  }, [selected, mode]);
  useEffect(() => {
    if (mode !== '2d' || !host.current) return;
    const element = host.current;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const viewWidth = Math.max(580, (width / height) * 680);
      setViewBoxWidth(viewWidth);
      const scale = Math.min(width / viewWidth, height / 680) * zoom2d;
      const positions: MapPositions = {};
      for (let id = 1; id <= 5; id++) {
        const [x, y] = svgPoint(points[id as Stage]);
        positions[id] = {
          x: 50 + (((x - 500) * scale) / width) * 100,
          y: 50 + (((y - 340) * scale) / height) * 100,
          visible: true,
        };
      }
      onProject(positions);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [mode, zoom2d, onProject]);
  const stagePoints = checkpoints.map((s) => svgPoint(points[s.id]));
  return (
    <section
      className={`tunisia-map-card ${overview ? 'is-overview' : ''}`}
      aria-label={l('خريطة تونس الرمزية التفاعلية', 'Carte interactive symbolique de la Tunisie')}
    >
      <div className="journey-map-topline">
        <span>
          <Compass size={18} />{' '}
          {l('تونس، خمس محطات لمسار واحد', 'La Tunisie, cinq étapes d’un même parcours')}
        </span>
        <div
          className="journey-view-toggle"
          aria-label={l('طريقة عرض الخريطة', 'Mode de la carte')}
        >
          <button
            type="button"
            aria-pressed={mode === '3d'}
            disabled={unavailable}
            onClick={() => setMode('3d')}
          >
            3D
          </button>
          <button type="button" aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
            2D
          </button>
        </div>
      </div>
      {unavailable && (
        <p className="journey-fallback-notice" role="status">
          {l(
            'تم تفعيل الخريطة التفاعلية ثنائية الأبعاد لتوافقها مع هذا الجهاز.',
            'La carte interactive 2D est activée pour assurer la compatibilité avec cet appareil.',
          )}
        </p>
      )}
      <div className="tunisia-map-viewport" ref={host} dir="ltr" data-mode={mode}>
        <div className="map-compass" aria-hidden="true">
          <span>N</span>
          <Compass size={26} strokeWidth={1} />
        </div>
        <span className="map-sea-label" aria-hidden="true">
          {l('البحر الأبيض المتوسط', 'MÉDITERRANÉE')}
        </span>
        {mode === '3d' ? (
          <Suspense
            fallback={
              <div className="map-loading" role="status">
                {l('تحميل الخريطة ثلاثية الأبعاد…', 'Chargement de la carte 3D…')}
              </div>
            }
          >
            <WebGL
              checkpoints={checkpoints}
              loop={hasExtension}
              onReady={onReady}
              onProject={onProject}
              onFailure={onFailure}
            />
          </Suspense>
        ) : (
          <svg
            className="tunisia-svg"
            viewBox={`${500 - viewBoxWidth / 2} 0 ${viewBoxWidth} 680`}
            role="img"
            aria-label={l(
              'شكل تونس الجغرافي مع محطات رمزية',
              'Silhouette géographique de la Tunisie et étapes symboliques',
            )}
          >
            <defs>
              <linearGradient id="tunisia-land" x2="1" y2="1">
                <stop stopColor="#e1eee6" />
                <stop offset="1" stopColor="#9bc6b3" />
              </linearGradient>
              <filter id="tunisia-shadow">
                <feDropShadow
                  dx="0"
                  dy="9"
                  stdDeviation="8"
                  floodColor="#173e4d"
                  floodOpacity=".16"
                />
              </filter>
            </defs>
            <g transform={`translate(500 340) scale(${zoom2d}) translate(-500 -340)`}>
              <path
                d={silhouettePath}
                fill="url(#tunisia-land)"
                stroke="#77a899"
                strokeWidth="1.6"
                fillRule="evenodd"
                filter="url(#tunisia-shadow)"
              />
              {stagePoints.slice(0, -1).map((p, i) => (
                <path
                  key={i}
                  d={`M${p.join(',')} Q${(p[0] + stagePoints[i + 1][0]) / 2 + 14},${(p[1] + stagePoints[i + 1][1]) / 2} ${stagePoints[i + 1].join(',')}`}
                  fill="none"
                  stroke={checkpoints[i].status === 'completed' ? '#278a75' : '#869da6'}
                  strokeWidth="3"
                  strokeDasharray={checkpoints[i].status === 'completed' ? undefined : '7 6'}
                />
              ))}
              {hasExtension && (
                <path
                  data-testid="rehabilitation-loop-2d"
                  d={`M${stagePoints[3].join(',')} C${stagePoints[3][0] - 95},${stagePoints[3][1]} ${stagePoints[2][0] - 95},${stagePoints[2][1]} ${stagePoints[2].join(',')}`}
                  fill="none"
                  stroke="#d49137"
                  strokeWidth="3"
                  strokeDasharray="6 5"
                />
              )}
            </g>
          </svg>
        )}
        {checkpoints.map(
          (s) =>
            positions[s.id] && (
              <JourneyCheckpoint
                key={s.id}
                checkpoint={s}
                selected={selected === s.id}
                position={positions[s.id]}
                onSelect={onSelect}
              />
            ),
        )}
        <div className="journey-map-controls" dir="ltr">
          <IconButton
            label={l('تكبير', 'Zoom avant')}
            onClick={() =>
              mode === '3d' ? scene.current?.zoom(0.86) : setZoom2d((z) => Math.min(1.45, z + 0.12))
            }
          >
            <Plus size={17} />
          </IconButton>
          <IconButton
            label={l('تصغير', 'Zoom arrière')}
            onClick={() =>
              mode === '3d' ? scene.current?.zoom(1.16) : setZoom2d((z) => Math.max(0.65, z - 0.12))
            }
          >
            <Minus size={17} />
          </IconButton>
          {mode === '3d' && (
            <>
              <IconButton
                label={l('دوران لليسار', 'Tourner à gauche')}
                onClick={() => scene.current?.rotate(-0.25)}
              >
                <RotateCcw size={16} />
              </IconButton>
              <IconButton
                label={l('دوران لليمين', 'Tourner à droite')}
                onClick={() => scene.current?.rotate(0.25)}
              >
                <RotateCw size={16} />
              </IconButton>
            </>
          )}
          <IconButton
            label={l('إعادة ضبط العرض', 'Réinitialiser la vue')}
            onClick={() => {
              scene.current?.reset();
              setZoom2d(1);
            }}
          >
            <Focus size={17} />
          </IconButton>
        </div>
        <div className="map-interaction-hint">
          {mode === '3d'
            ? l(
                'اسحب للدوران · مرّر للتكبير · اختر محطة',
                'Glissez pour tourner · Défilez pour zoomer · Choisissez une étape',
              )
            : l('اختر محطة لاستكشاف تفاصيلها', 'Choisissez une étape pour en explorer les détails')}
        </div>
      </div>
      <div className="journey-map-legend">
        {(['completed', 'current', 'pending', 'notStarted', 'future'] as const).map((status) => (
          <span key={status}>
            <i className={`legend-${status}`} />
            {b(
              {
                completed: { ar: 'مكتملة', fr: 'Terminée' },
                current: { ar: 'حالية', fr: 'Actuelle' },
                pending: { ar: 'في الانتظار', fr: 'En attente' },
                notStarted: { ar: 'لم تبدأ', fr: 'À venir' },
                future: { ar: 'مستقبلية', fr: 'Future' },
              }[status],
            )}
          </span>
        ))}
      </div>
      <p className="journey-map-caption">
        {l(
          'خريطة رمزية لمسار المرافقة، لا تمثل مواقع الأطفال أو تنقلاتهم. الحدود: Natural Earth.',
          'Un parcours symbolique d’accompagnement, sans localisation ni déplacement d’enfant. Contours : Natural Earth.',
        )}
      </p>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { createTunisiaScene } from './TunisiaScene';
import type { MapScene, MapPositions } from './TunisiaScene';
import type { JourneyCheckpointData } from './types';

export default function TunisiaWebGL({
  checkpoints,
  loop,
  onReady,
  onProject,
  onFailure,
}: {
  checkpoints: JourneyCheckpointData[];
  loop: boolean;
  onReady: (scene: MapScene | null) => void;
  onProject: (p: MapPositions) => void;
  onFailure: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const scene = useRef<MapScene | null>(null);
  useEffect(() => {
    try {
      scene.current = createTunisiaScene(element.current!, onProject, onFailure);
      onReady(scene.current);
    } catch {
      onFailure();
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
      onReady(null);
    };
  }, [onReady, onProject, onFailure]);
  useEffect(() => {
    scene.current?.update(checkpoints, loop);
  }, [checkpoints, loop]);
  return <div ref={element} className="tunisia-webgl" data-testid="tunisia-webgl" />;
}

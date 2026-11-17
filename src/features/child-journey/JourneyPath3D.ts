import * as THREE from 'three';
import { points } from './mapGeometry';
import type { JourneyCheckpointData } from './types';
import type { Stage } from '../../types';

export function createJourneyPath(checkpoints: JourneyCheckpointData[], hasExtension: boolean) {
  const group = new THREE.Group();
  for (let i = 1; i < 5; i++) {
    const from = points[i as Stage],
      to = points[(i + 1) as Stage];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(from[0], 0.48, from[1]),
      new THREE.Vector3((from[0] + to[0]) / 2 + 0.16, 0.53, (from[1] + to[1]) / 2),
      new THREE.Vector3(to[0], 0.48, to[1]),
    ]);
    if (checkpoints[i - 1]?.status === 'completed') {
      group.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.028, 6, false),
          new THREE.MeshStandardMaterial({ color: '#278a75', roughness: 0.55 }),
        ),
      );
    } else {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)),
        new THREE.LineDashedMaterial({
          color: '#78949e',
          dashSize: 0.12,
          gapSize: 0.09,
          transparent: true,
          opacity: 0.8,
        }),
      );
      line.computeLineDistances();
      group.add(line);
    }
  }
  if (hasExtension) {
    const a = points[4],
      b = points[3];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(a[0], 0.55, a[1]),
      new THREE.Vector3(a[0] - 0.85, 0.65, (a[1] + b[1]) / 2),
      new THREE.Vector3(b[0], 0.55, b[1]),
    ]);
    const loop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
      new THREE.LineDashedMaterial({ color: '#d49137', dashSize: 0.11, gapSize: 0.06 }),
    );
    loop.computeLineDistances();
    group.add(loop);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.2, 8),
      new THREE.MeshBasicMaterial({ color: '#d49137' }),
    );
    arrow.position.copy(curve.getPoint(0.9));
    arrow.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      curve.getTangent(0.9).normalize(),
    );
    group.add(arrow);
  }
  return group;
}

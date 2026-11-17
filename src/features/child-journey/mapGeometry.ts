import geo from './geo/tunisia.json';
import type { Stage } from '../../types';
// Public, fixed symbolic checkpoints. Never derived from a child's address/location.
export const checkpointLocations: Record<Stage, [number, number]> = {
  1: [9.55, 36.75],
  2: [9.0, 35.65],
  3: [9.7, 34.65],
  4: [9.25, 33.35],
  5: [9.65, 31.7],
};
const centreX = (geo.bbox[0] + geo.bbox[2]) / 2;
const centreY = (geo.bbox[1] + geo.bbox[3]) / 2;
export function project([longitude, latitude]: readonly number[]): [number, number] {
  return [(longitude - centreX) * Math.cos((centreY * Math.PI) / 180), -(latitude - centreY)];
}
export const polygons = geo.coordinates.map((polygon) => polygon.map((ring) => ring.map(project)));
export const points = Object.fromEntries(
  Object.entries(checkpointLocations).map(([stage, point]) => [stage, project(point)]),
) as Record<Stage, [number, number]>;
export const svgPoint = ([x, z]: readonly number[]): [number, number] => [
  500 + x * 73,
  340 + z * 73,
];
export const silhouettePath = polygons
  .flatMap((polygon) =>
    polygon.map(
      (ring) => ring.map((p, i) => `${i ? 'L' : 'M'}${svgPoint(p).join(',')}`).join(' ') + 'Z',
    ),
  )
  .join(' ');

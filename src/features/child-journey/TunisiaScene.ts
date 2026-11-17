import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { polygons, points } from './mapGeometry';
import { createJourneyPath } from './JourneyPath3D';
import type { JourneyCheckpointData } from './types';
import type { Stage } from '../../types';

export interface MapScene {
  focus: (id: Stage) => void;
  zoom: (factor: number) => void;
  rotate: (angle: number) => void;
  reset: () => void;
  update: (checkpoints: JourneyCheckpointData[], loop: boolean) => void;
  dispose: () => void;
}
export type MapPositions = Record<number, { x: number; y: number; visible: boolean }>;
const color = (s: JourneyCheckpointData) =>
  s.current
    ? '#438bd0'
    : s.status === 'completed'
      ? '#369b80'
      : s.status === 'pending'
        ? '#dc9c42'
        : '#8b9da5';

function release(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    materials.forEach((m) => m.dispose());
  });
}

/** Only public geometry and five sanitized checkpoint summaries reach WebGL. */
export function createTunisiaScene(
  host: HTMLElement,
  onProject: (p: MapPositions) => void,
  onFailure: () => void,
): MapScene {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const initialPosition = new THREE.Vector3(3.4, 11.8, 8.1);
  camera.position.copy(initialPosition);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 5.8;
  controls.maxDistance = 20;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2.35;
  controls.update();
  scene.add(new THREE.HemisphereLight('#eafaff', '#819d9e', 1.8));
  const sun = new THREE.DirectionalLight('#ffffff', 2.6);
  sun.position.set(-4, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#8bdac7', 0.9);
  fill.position.set(5, 4, -4);
  scene.add(fill);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.14 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.28;
  ground.receiveShadow = true;
  scene.add(ground);
  const land = new THREE.Group();
  scene.add(land);
  for (const polygon of polygons) {
    const shape = new THREE.Shape(polygon[0].map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const hole of polygon.slice(1))
      shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.035,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, [
      new THREE.MeshStandardMaterial({ color: '#b4d6c7', roughness: 0.86, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ color: '#426f70', roughness: 0.7 }),
    ]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    land.add(mesh);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 32),
      new THREE.LineBasicMaterial({ color: '#d7eee5', transparent: true, opacity: 0.45 }),
    );
    land.add(edge);
  }
  const grid = new THREE.GridHelper(16, 32, '#c9dbde', '#dce7e9');
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.23;
  grid.position.y = -0.25;
  scene.add(grid);
  let route: THREE.Group | undefined;
  const markers = new THREE.Group();
  scene.add(markers);
  let frame = 0,
    animation = 0,
    disposed = false;
  const projected = new THREE.Vector3();
  function render() {
    frame = 0;
    if (disposed) return;
    renderer.render(scene, camera);
    const positions: MapPositions = {};
    for (let id = 1; id <= 5; id++) {
      const [x, z] = points[id as Stage];
      projected.set(x, 0.75, z).project(camera);
      positions[id] = {
        x: (projected.x + 1) * 50,
        y: (1 - projected.y) * 50,
        visible: projected.z < 1 && Math.abs(projected.x) < 1.3 && Math.abs(projected.y) < 1.3,
      };
    }
    onProject(positions);
  }
  const invalidate = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  };
  controls.addEventListener('change', invalidate);
  controls.addEventListener('start', () => {
    cancelAnimationFrame(animation);
  });
  const observer = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    invalidate();
  });
  observer.observe(host);
  const lost = (e: Event) => {
    e.preventDefault();
    if (!disposed) onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  function move(position: THREE.Vector3, target: THREE.Vector3) {
    cancelAnimationFrame(animation);
    const start = performance.now(),
      old = camera.position.clone(),
      oldTarget = controls.target.clone();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600;
    function tick(now: number) {
      if (disposed) return;
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(old, position, ease);
      controls.target.lerpVectors(oldTarget, target, ease);
      controls.update();
      invalidate();
      if (t < 1) animation = requestAnimationFrame(tick);
    }
    animation = requestAnimationFrame(tick);
  }
  return {
    focus(id) {
      const [x, z] = points[id];
      const target = new THREE.Vector3(x * 0.3, 0.05, z * 0.3);
      move(initialPosition.clone().multiplyScalar(0.92).add(target), target);
    },
    zoom(factor) {
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      controls.update();
      invalidate();
    },
    rotate(angle) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      camera.position.copy(offset.add(controls.target));
      controls.update();
      invalidate();
    },
    reset() {
      move(initialPosition, new THREE.Vector3());
    },
    update(checkpoints, loop) {
      if (route) {
        scene.remove(route);
        release(route);
      }
      route = createJourneyPath(checkpoints, loop);
      scene.add(route);
      release(markers);
      markers.clear();
      for (const s of checkpoints) {
        const [x, z] = points[s.id];
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.043, 0.07, 0.25, 10),
          new THREE.MeshStandardMaterial({ color: color(s), roughness: 0.4 }),
        );
        stem.position.set(x, 0.49, z);
        markers.add(stem);
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(s.current ? 0.14 : 0.11, 16, 10),
          new THREE.MeshStandardMaterial({
            color: color(s),
            emissive: color(s),
            emissiveIntensity: s.current ? 0.65 : 0.15,
            roughness: 0.35,
          }),
        );
        dot.position.set(x, 0.69, z);
        markers.add(dot);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(s.current ? 0.25 : 0.18, 0.012, 6, 32),
          new THREE.MeshBasicMaterial({ color: color(s), transparent: true, opacity: 0.7 }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.39, z);
        markers.add(ring);
      }
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(animation);
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      controls.dispose();
      release(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

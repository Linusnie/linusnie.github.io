import * as THREE from 'https://esm.sh/three@0.160.0';
import { TrackballControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/TrackballControls.js';
import { LineSegments2 } from 'https://esm.sh/three@0.160.0/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'https://esm.sh/three@0.160.0/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'https://esm.sh/three@0.160.0/examples/jsm/lines/LineMaterial.js';

const BG_COLOR = 0xfaf9f7;
const FRUSTUM_COLOR = 0x1e40af;
const FRUSTUM_FACE_COLOR = 0x93c5fd;
const RAY_COLOR = 0x1d4ed8;
const POINT_COLOR = 0xdc2626;

function createCameraFrustum(position, lookAt, resolution) {
  const height = 0.5;
  const w = 0.4;
  const h = 0.28;
  // Apex at origin, base at +Z (Three.js lookAt uses +Z as forward)
  const vertices = new Float32Array([
    0, 0, 0,
    -w / 2, -h / 2, height,
    w / 2, -h / 2, height,
    w / 2, h / 2, height,
    -w / 2, h / 2, height,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 1, 2, 3, 1, 3, 4];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const group = new THREE.Group();

  const faceMat = new THREE.MeshBasicMaterial({
    color: FRUSTUM_FACE_COLOR,
    opacity: 1,
    transparent: false,
    side: THREE.DoubleSide,
  });
  const faceMesh = new THREE.Mesh(geometry.clone(), faceMat);
  group.add(faceMesh);

  const edges = new THREE.EdgesGeometry(geometry);
  const lineGeo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
  const lineMat = new LineMaterial({
    color: FRUSTUM_COLOR,
    linewidth: 2,
    resolution,
  });
  const edgeLines = new LineSegments2(lineGeo, lineMat);
  group.add(edgeLines);

  group.position.copy(position);
  group.lookAt(lookAt);
  return group;
}

function createRay(from, through, color = RAY_COLOR) {
  const dir = new THREE.Vector3().subVectors(through, from).normalize();
  const extendLength = 4;
  const far = through.clone().add(dir.multiplyScalar(extendLength));
  const length = from.distanceTo(far);
  const geometry = new THREE.CylinderGeometry(0.012, 0.012, length, 8);
  const material = new THREE.MeshBasicMaterial({ color });
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.position.copy(from).add(far).multiplyScalar(0.5);
  const rayDir = new THREE.Vector3().subVectors(far, from).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    rayDir
  );
  cylinder.quaternion.copy(quat);
  return cylinder;
}

function init() {
  const container = document.getElementById('triangulation-canvas');
  if (!container) return;

  let width = container.clientWidth;
  let height = container.clientHeight;

  if (width === 0 || height === 0) {
    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        observer.disconnect();
        createScene(container, w, h);
      }
    });
    observer.observe(container);
    return;
  }

  createScene(container, width, height);
}

function createScene(container, width, height) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(4, 1.5, 5);
  camera.lookAt(0, 0.8, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', () => window.getSelection()?.removeAllRanges(), true);

  const controls = new TrackballControls(camera, canvas);
  controls.target.set(0, 0.8, 0);
  controls.mouseButtons.RIGHT = -1;
  controls.staticMoving = false;
  controls.rotateSpeed = 3.5;
  controls.zoomSpeed = 1.4;
  controls.panSpeed = 0.8;
  controls.minDistance = 3;
  controls.maxDistance = 12;

  const resolution = new THREE.Vector2(width, height);

  const point = new THREE.Vector3(0, 1.2, 0);
  const noiseScale = 0.18;
  const camPositions = [
    new THREE.Vector3(1.5, 0.2, 1.2),
    new THREE.Vector3(-1.3, 0.1, 1.2),
    new THREE.Vector3(0.1, -0.3, 1.2),
    new THREE.Vector3(1.1, -0.1, -0.8),
    new THREE.Vector3(-0.9, 0.15, -0.7),
  ];
  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const noisyTargets = camPositions.map((pos, i) => {
    return point.clone().add(
      new THREE.Vector3(
        (seededRandom(i * 3) - 0.5) * noiseScale,
        (seededRandom(i * 3 + 1) - 0.5) * noiseScale,
        (seededRandom(i * 3 + 2) - 0.5) * noiseScale
      )
    );
  });

  camPositions.forEach((pos, i) => {
    scene.add(createCameraFrustum(pos, noisyTargets[i], resolution));
    scene.add(createRay(pos, noisyTargets[i]));
  });

  const sphereGeo = new THREE.SphereGeometry(0.12, 32, 32);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: POINT_COLOR,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(point);
  scene.add(sphere);

  const gridHelper = new THREE.GridHelper(4, 8, 0x94a3b8, 0xcbd5e1);
  gridHelper.position.y = -0.8;
  scene.add(gridHelper);

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    controls.handleResize();
    resolution.set(w, h);
    scene.traverse((obj) => {
      if (obj.isLineSegments2 && obj.material.resolution) {
        obj.material.resolution.set(w, h);
      }
    });
  }

  window.addEventListener('resize', onResize);
  const resizeObserver = new ResizeObserver(() => onResize());
  resizeObserver.observe(container);

  let autoRotate = true;
  let lastInteraction = 0;
  const autoRotateSpeed = 0.3;
  controls.addEventListener('start', () => {
    autoRotate = false;
    lastInteraction = Date.now();
  });

  function animate() {
    requestAnimationFrame(animate);
    const now = Date.now();
    if (now - lastInteraction > 2000) autoRotate = true;
    if (autoRotate) {
      const eye = new THREE.Vector3().subVectors(camera.position, controls.target);
      eye.applyAxisAngle(new THREE.Vector3(0, 1, 0), autoRotateSpeed * 0.01);
      camera.position.copy(controls.target).add(eye);
      camera.lookAt(controls.target);
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

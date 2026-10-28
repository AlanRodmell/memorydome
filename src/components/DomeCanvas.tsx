import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PhotoMeta, TapestryRing } from '../types/dome';
import { getPhotoUrl, EXTERNAL_DOME_URL } from '../services/memoryDomeService';

interface DomeCanvasProps {
  photoFiles: string[];
  photoVersion?: string;
  baseUrl: string;
  numRings?: number;
  totalPhotos?: number;
  autoOrbit: boolean;
  orbitSpeed?: number;
  seamsVisible: boolean;
  loopMemories?: boolean;
  targetDay: number | null;
  onSelectPhoto: (day: number) => void;
  onLoadingProgress: (done: number, total: number) => void;
  onFovChange: (fov: number) => void;
  currentZoom: number;
  onRegisterFlyTo: (flyFn: (day: number, zoomFov?: number) => void) => void;
  onCoordinatesChange?: (azimuth: number, elevation: number) => void;
  onInteractionStart?: () => void;
}

const SPHERE_RADIUS = 135;
const CAMERA_EYE_HEIGHT = 0; // Centered in the 360° celestial sphere

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || canvas.getContext('webgl2'))
    );
  } catch {
    return false;
  }
}

export const DomeCanvas: React.FC<DomeCanvasProps> = ({
  photoFiles,
  photoVersion,
  baseUrl,
  numRings = 25,
  totalPhotos = 750,
  autoOrbit,
  orbitSpeed = 1,
  seamsVisible,
  loopMemories = false,
  targetDay,
  onSelectPhoto,
  onLoadingProgress,
  onFovChange,
  onRegisterFlyTo,
  onCoordinatesChange,
  onInteractionStart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    lon: 180,
    lat: 10,
    targetLon: 180,
    targetLat: 10,
    currentFov: 62,
    targetFov: 62,
    autoOrbit,
    orbitSpeed,
    isPointerDown: false,
    pointerDownX: 0,
    pointerDownY: 0,
    pointerDownLon: 0,
    pointerDownLat: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    lastPointerMoveTime: 0,
    velocityLon: 0,
    velocityLat: 0,
    lastReportedAzimuth: -1,
    lastReportedElevation: -1,
    dragDistance: 0,
    wasPinching: false,
    pinchStartDist: null as number | null,
    pinchStartFov: 62,
    activePointers: new Map<number, { x: number; y: number }>(),
    hoveredMesh: null as THREE.Mesh | null,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    highlightFrame: null as THREE.Mesh | null,
    seamGroup: null as THREE.Group | null,
    photoMeshesByDay: {} as Record<number, THREE.Mesh>,
    photoDataStore: {} as Record<number, PhotoMeta>,
    originalPositions: new Map<number, THREE.Vector3>(),
    allPhotoMeshes: [] as THREE.Mesh[],
    shootingStars: [] as Array<{ mesh: THREE.Line; vel: THREE.Vector3; life: number }>,
    starSkyGroup: null as THREE.Group | null,
    fallbackStars: [] as Array<{ lon: number; lat: number; size: number; color: string }>,
    animFrameId: 0,
    useFallback2D: false,
    fallbackCanvas: null as HTMLCanvasElement | null,
    fallbackCtx: null as CanvasRenderingContext2D | null,
    placeholderCanvas: null as HTMLCanvasElement | null,
  });

  // Sync autoOrbit & orbitSpeed
  useEffect(() => {
    stateRef.current.autoOrbit = autoOrbit;
  }, [autoOrbit]);

  useEffect(() => {
    stateRef.current.orbitSpeed = orbitSpeed;
  }, [orbitSpeed]);

  // Seams visibility
  useEffect(() => {
    if (stateRef.current.seamGroup) {
      stateRef.current.seamGroup.visible = seamsVisible;
    }
  }, [seamsVisible]);

  // Fly to target day
  useEffect(() => {
    if (targetDay !== null) {
      flyCameraToDay(targetDay, 28);
    }
  }, [targetDay]);

  const flyCameraToDay = (dayNumber: number, customZoomFov = 28) => {
    const s = stateRef.current;
    const day = Math.max(1, Math.min(totalPhotos, Math.round(dayNumber)));
    const meta = s.photoDataStore[day];
    if (!meta) return;

    let computedLon = 180 - meta.azimuth;
    let computedLat = meta.elevation;

    if (day === 1) {
      computedLat = 88.5;
      computedLon = s.targetLon;
    } else if (day === totalPhotos) {
      computedLat = -88.5;
      computedLon = s.targetLon;
    }

    const lonDelta = ((((computedLon - s.targetLon) % 360) + 540) % 360) - 180;
    s.targetLat = Math.max(-89.5, Math.min(89.5, computedLat));
    s.targetLon = s.targetLon + lonDelta;
    s.targetFov = Math.max(16, Math.min(78, customZoomFov));
    s.autoOrbit = false;
    onFovChange(s.targetFov);

    const mesh = s.photoMeshesByDay[day];
    if (mesh) {
      setHoveredTile(mesh);
    }
  };

  useEffect(() => {
    onRegisterFlyTo(flyCameraToDay);
  }, [onRegisterFlyTo]);

  // Pop-out lift effect for hovered/selected tile
  const setHoveredTile = (mesh: THREE.Mesh | null) => {
    const s = stateRef.current;
    if (s.hoveredMesh === mesh) return;

    // Reset previous hovered mesh to its resting knitted position
    if (s.hoveredMesh) {
      const prevDay = s.hoveredMesh.userData.day;
      const origPos = s.originalPositions.get(prevDay);
      if (origPos) {
        s.hoveredMesh.position.copy(origPos);
      }
      s.hoveredMesh.scale.set(1, 1, 1);
    }

    s.hoveredMesh = mesh;

    // Lift new mesh slightly toward camera to remove all perspective occlusion
    if (mesh) {
      const day = mesh.userData.day;
      if (!s.originalPositions.has(day)) {
        s.originalPositions.set(day, mesh.position.clone());
      }
      const origPos = s.originalPositions.get(day)!;
      // Lift 3.8 units inward towards center (0,0,0)
      mesh.position.copy(origPos).multiplyScalar(0.972);
      mesh.scale.set(1.05, 1.05, 1.05);

      if (s.highlightFrame) {
        const meta = s.photoDataStore[day];
        if (meta) {
          s.highlightFrame.position.copy(mesh.position).multiplyScalar(0.999);
          s.highlightFrame.quaternion.copy(mesh.quaternion);
          s.highlightFrame.scale.set(meta.tileW * 1.06, meta.tileH * 1.06, 1);
          s.highlightFrame.visible = true;
        }
      }
    } else {
      if (s.highlightFrame) s.highlightFrame.visible = false;
    }
  };

  // Build 360° Knitted Spherical Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const s = stateRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || window.innerWidth || 1200;
    const height = container.clientHeight || window.innerHeight || 800;

    s.photoMeshesByDay = {};
    s.photoDataStore = {};
    s.originalPositions.clear();
    s.allPhotoMeshes = [];
    s.shootingStars = [];
    s.fallbackStars = [];
    s.hoveredMesh = null;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03050c, 0.0009);
    s.scene = scene;

    // Camera at center of 360° sphere
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.5, 1200);
    camera.position.set(0, CAMERA_EYE_HEIGHT, 0.01);
    s.camera = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const centerLightTop = new THREE.PointLight(0xfbbf24, 1.7, 300);
    centerLightTop.position.set(0, 35, 0);
    scene.add(centerLightTop);

    const centerLightBottom = new THREE.PointLight(0x38bdf8, 1.5, 300);
    centerLightBottom.position.set(0, -35, 0);
    scene.add(centerLightBottom);

    // Renderer Initialization
    let renderer: THREE.WebGLRenderer | null = null;
    const webglSupported = isWebGLSupported();

    if (webglSupported) {
      const renderOptions: THREE.WebGLRendererParameters[] = [
        { antialias: true, powerPreference: 'high-performance' },
        { antialias: false, powerPreference: 'default' },
        { antialias: false, failIfMajorPerformanceCaveat: false },
      ];

      for (const opts of renderOptions) {
        try {
          renderer = new THREE.WebGLRenderer(opts);
          renderer.setSize(width, height);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.15;
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = '100%';
          renderer.domElement.style.display = 'block';
          renderer.domElement.style.position = 'absolute';
          renderer.domElement.style.top = '0';
          renderer.domElement.style.left = '0';
          container.appendChild(renderer.domElement);
          s.renderer = renderer;
          s.useFallback2D = false;
          break;
        } catch {
          renderer = null;
        }
      }
    }

    if (!renderer) {
      s.useFallback2D = true;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.display = 'block';
      c.style.position = 'absolute';
      c.style.top = '0';
      c.style.left = '0';
      container.appendChild(c);
      s.fallbackCanvas = c;
      s.fallbackCtx = c.getContext('2d');
    }

    // 4200 Celestial Stars covering the entire 360° sphere
    const starGroup = new THREE.Group();
    const starCount = 4200;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const starPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xfde68a),
      new THREE.Color(0xbfdbfe),
      new THREE.Color(0xfbcfe8),
      new THREE.Color(0x6ee7b7),
    ];
    for (let i = 0; i < starCount; i++) {
      const r = 240 + Math.random() * 160;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const col = starPalette[i % starPalette.length];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      if (i < 500) {
        s.fallbackStars.push({
          lon: THREE.MathUtils.radToDeg(theta),
          lat: 90 - THREE.MathUtils.radToDeg(phi),
          size: Math.random() * 1.5 + 0.8,
          color: ['#ffffff', '#fde68a', '#bfdbfe'][i % 3],
        });
      }
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
    });
    starGroup.add(new THREE.Points(starGeo, starMat));
    scene.add(starGroup);
    s.starSkyGroup = starGroup;

    // Floating Glass Observation Platform in Center
    const platformGroup = new THREE.Group();
    const platCanvas = document.createElement('canvas');
    platCanvas.width = 512;
    platCanvas.height = 512;
    const pctx = platCanvas.getContext('2d');
    if (pctx) {
      pctx.clearRect(0, 0, 512, 512);

      pctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      pctx.lineWidth = 4;
      pctx.beginPath();
      pctx.arc(256, 256, 240, 0, Math.PI * 2);
      pctx.stroke();

      pctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.arc(256, 256, 200, 0, Math.PI * 2);
      pctx.stroke();

      pctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      pctx.lineWidth = 1.5;
      for (let a = 0; a < 360; a += 15) {
        const rad = (a * Math.PI) / 180;
        pctx.beginPath();
        pctx.moveTo(256 + Math.cos(rad) * 170, 256 + Math.sin(rad) * 170);
        pctx.lineTo(256 + Math.cos(rad) * 240, 256 + Math.sin(rad) * 240);
        pctx.stroke();
      }

      const g = pctx.createRadialGradient(256, 256, 10, 256, 256, 180);
      g.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      g.addColorStop(0.8, 'rgba(10, 15, 32, 0.2)');
      g.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
      pctx.fillStyle = g;
      pctx.beginPath();
      pctx.arc(256, 256, 180, 0, Math.PI * 2);
      pctx.fill();

      pctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
      pctx.font = '600 14px "Cormorant Garamond", Georgia, serif';
      pctx.textAlign = 'center';
      pctx.fillText('CEREBRO 360° MEMORY SPHERE', 256, 250);
      pctx.font = '500 9px "Inter", sans-serif';
      pctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
      pctx.fillText('FLOATING OBSERVATION CHAMBER', 256, 268);
    }

    const platTex = new THREE.CanvasTexture(platCanvas);
    const platGeo = new THREE.CircleGeometry(26, 64);
    platGeo.rotateX(-Math.PI / 2);
    const platMat = new THREE.MeshBasicMaterial({
      map: platTex,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const platMesh = new THREE.Mesh(platGeo, platMat);
    platMesh.position.y = -2.2;
    platformGroup.add(platMesh);

    // Glowing golden equatorial horizon ring (marking 0° latitude equator)
    const eqRingGeo = new THREE.RingGeometry(SPHERE_RADIUS - 0.7, SPHERE_RADIUS + 0.7, 128);
    eqRingGeo.rotateX(-Math.PI / 2);
    const eqRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const eqRing = new THREE.Mesh(eqRingGeo, eqRingMat);
    eqRing.position.y = 0;
    platformGroup.add(eqRing);
    scene.add(platformGroup);

    // Highlight Frame
    const highlightGeo = new THREE.PlaneGeometry(1, 1);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const highlightFrame = new THREE.Mesh(highlightGeo, highlightMat);
    highlightFrame.visible = false;
    scene.add(highlightFrame);
    s.highlightFrame = highlightFrame;

    // 360° Knitted Spherical Photo Tapestry Group
    const spherePhotosGroup = new THREE.Group();
    scene.add(spherePhotosGroup);

    // Placeholder Tile Texture with Subtle Knitted Shingle Shadow Border
    const placeholderCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 160;
      const pctx2 = c.getContext('2d');
      if (pctx2) {
        // Deep cosmic card base
        const g2 = pctx2.createLinearGradient(0, 0, 160, 160);
        g2.addColorStop(0, '#0c1633');
        g2.addColorStop(0.5, '#16224d');
        g2.addColorStop(1, '#080d21');
        pctx2.fillStyle = g2;
        pctx2.fillRect(0, 0, 160, 160);

        // Soft drop-shadow border around edges to enhance knitted overlap depth
        const shadowGrad = pctx2.createRadialGradient(80, 80, 56, 80, 80, 80);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
        pctx2.fillStyle = shadowGrad;
        pctx2.fillRect(0, 0, 160, 160);

        // Gold border
        pctx2.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        pctx2.lineWidth = 3;
        pctx2.strokeRect(3, 3, 154, 154);

        pctx2.strokeStyle = 'rgba(251, 191, 36, 0.18)';
        pctx2.lineWidth = 1;
        pctx2.strokeRect(8, 8, 144, 144);
      }
      return c;
    })();
    s.placeholderCanvas = placeholderCanvas;

    const placeholderTex = new THREE.CanvasTexture(placeholderCanvas);
    const placeholderMaterial = new THREE.MeshBasicMaterial({
      map: placeholderTex,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    // Compute Full Spherical Rings (spanning +82° Zenith down to -82° Nadir)
    const computeFullSphereRings = (totalTiles: number, ringsCount: number) => {
      const remaining = totalTiles - 2; // Subtract top (#1) and bottom (#totalTiles) keystones
      const latTopDeg = 82;
      const latBottomDeg = -82;
      const latStepDeg = (latTopDeg - latBottomDeg) / (ringsCount - 1);
      const rings: TapestryRing[] = [];
      let weightSum = 0;
      const minPerRing = totalTiles < 120 ? 3 : totalTiles < 300 ? 4 : 6;

      for (let r = 0; r < ringsCount; r++) {
        const latDeg = latTopDeg - r * latStepDeg;
        const latRad = THREE.MathUtils.degToRad(latDeg);
        const weight = Math.cos(latRad);
        rings.push({ ringIndex: r + 1, latDeg, latRad, weight, count: 0 });
        weightSum += weight;
      }

      let assigned = 0;
      const remainders: Array<{ idx: number; rem: number }> = [];
      for (let r = 0; r < ringsCount; r++) {
        const exact = (rings[r].weight / weightSum) * remaining;
        const floored = Math.max(minPerRing, Math.floor(exact));
        rings[r].count = floored;
        assigned += floored;
        remainders.push({ idx: r, rem: exact - floored });
      }

      let diff = remaining - assigned;
      remainders.sort((a, b) => b.rem - a.rem);
      let k = 0;
      let guard = 0;
      while (diff !== 0 && guard++ < 10000) {
        const targetIdx = remainders[k % ringsCount].idx;
        if (diff > 0) {
          rings[targetIdx].count += 1;
          diff--;
        } else if (rings[targetIdx].count > minPerRing) {
          rings[targetIdx].count -= 1;
          diff++;
        }
        k++;
      }
      return { rings, latStepDeg };
    };

    const tapestryRingLatitudes: Array<{ y: number; ringRadius: number; latDeg: number }> = [];

    const getFilenameForDay = (day: number) => {
      if (photoFiles.length === 0) return undefined;
      if (loopMemories) {
        return photoFiles[(day - 1) % photoFiles.length];
      }
      return day <= photoFiles.length ? photoFiles[day - 1] : undefined;
    };

    const addTile = (
      day: number,
      pos: THREE.Vector3,
      geo: THREE.BufferGeometry,
      w: number,
      h: number,
      azimuth: number,
      elevation: number,
      isKeystoneTop: boolean,
      isKeystoneBottom: boolean,
      ringIdx = 0
    ) => {
      s.photoDataStore[day] = {
        day,
        position: pos.clone(),
        azimuth,
        elevation,
        tileW: w,
        tileH: h,
        img: null,
        filename: getFilenameForDay(day),
        ringIndex: ringIdx,
      };

      s.originalPositions.set(day, pos.clone());

      const mesh = new THREE.Mesh(geo, placeholderMaterial.clone());
      mesh.position.copy(pos);

      if (isKeystoneTop) {
        mesh.up.set(0, 0, -1);
      } else if (isKeystoneBottom) {
        mesh.up.set(0, 0, 1);
      }
      // Each mesh looks directly inward toward the center (0, 0, 0)
      mesh.lookAt(0, 0, 0);
      mesh.userData = { day };
      spherePhotosGroup.add(mesh);
      s.photoMeshesByDay[day] = mesh;
      s.allPhotoMeshes.push(mesh);
    };

    const { rings, latStepDeg } = computeFullSphereRings(totalPhotos, numRings);
    const ringArcHeight = SPHERE_RADIUS * THREE.MathUtils.degToRad(latStepDeg);

    // 1. Zenith Keystone: Tile #1 sits straight overhead (+90° elevation)
    // Generously sized to knit and overlap the northern top ring
    const keystoneSize = ringArcHeight * 1.62;
    addTile(
      1,
      new THREE.Vector3(0, SPHERE_RADIUS - 0.3, 0),
      new THREE.PlaneGeometry(keystoneSize, keystoneSize),
      keystoneSize,
      keystoneSize,
      0,
      90,
      true,
      false,
      0
    );

    // 2. Knitted Overlapping Rings spanning Northern, Equatorial, and Southern hemisphere
    let currentDay = 2;
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const count = ring.count;
      const baseRingRadius = SPHERE_RADIUS * Math.cos(ring.latRad);
      tapestryRingLatitudes.push({ y: SPHERE_RADIUS * Math.sin(ring.latRad), ringRadius: baseRingRadius, latDeg: ring.latDeg });

      const dTheta = (Math.PI * 2) / count;
      const baseChordWidth = 2 * baseRingRadius * Math.sin(dTheta / 2);

      // Overlap factor: Knitted shingle overlap removes gaps & perspective distortion
      const overlapX = 1.15; // 15% horizontal overlap with neighbors
      const overlapY = 1.18; // 18% vertical overlap with adjacent latitude rows
      const naturalTileWidth = Math.max(ringArcHeight * 0.92, baseChordWidth * overlapX);
      const naturalTileHeight = ringArcHeight * overlapY;

      const ringTileGeo = new THREE.PlaneGeometry(naturalTileWidth, naturalTileHeight);
      const rowAngleOffset = r % 2 === 1 ? dTheta * 0.5 : 0;

      for (let j = 0; j < count; j++) {
        if (currentDay >= totalPhotos) break;

        // Alternating radial shingle depth step: gives physical depth and eliminates z-fighting
        const shingleDepth = ((r % 2 === 0 ? 0.38 : -0.38) + (j % 2 === 0 ? 0.2 : -0.2));
        const tileRadius = SPHERE_RADIUS + shingleDepth;
        const y = tileRadius * Math.sin(ring.latRad);
        const ringRadius = tileRadius * Math.cos(ring.latRad);

        const theta = j * dTheta + rowAngleOffset;
        const pos = new THREE.Vector3(
          ringRadius * Math.sin(theta),
          y,
          ringRadius * Math.cos(theta)
        );
        const azimuthDeg = Math.round((THREE.MathUtils.radToDeg(theta) + 360) % 360);

        addTile(
          currentDay++,
          pos,
          ringTileGeo,
          naturalTileWidth,
          naturalTileHeight,
          azimuthDeg,
          Math.round(ring.latDeg),
          false,
          false,
          r + 1
        );
      }
    }

    // 3. Nadir Keystone: Tile #totalPhotos sits straight below (-90° elevation)
    // Generously sized to knit and overlap the southern bottom ring
    addTile(
      totalPhotos,
      new THREE.Vector3(0, -(SPHERE_RADIUS - 0.3), 0),
      new THREE.PlaneGeometry(keystoneSize, keystoneSize),
      keystoneSize,
      keystoneSize,
      0,
      -90,
      false,
      true,
      numRings + 1
    );

    // Full Spherical Celestial Seams
    const seamGroup = new THREE.Group();
    const seamMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.26,
    });

    tapestryRingLatitudes.forEach((ringInfo) => {
      const pts = [];
      for (let a = 0; a <= 96; a++) {
        const ang = (a / 96) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            Math.cos(ang) * ringInfo.ringRadius * 1.002,
            ringInfo.y,
            Math.sin(ang) * ringInfo.ringRadius * 1.002
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      seamGroup.add(new THREE.Line(geo, seamMat));
    });

    for (let m = 0; m < 16; m++) {
      const az = (m / 16) * Math.PI * 2;
      const pts = [];
      for (let el = -90; el <= 90; el += 3) {
        const rad = THREE.MathUtils.degToRad(el);
        const rAtY = SPHERE_RADIUS * 1.003 * Math.cos(rad);
        const y = SPHERE_RADIUS * 1.003 * Math.sin(rad);
        pts.push(new THREE.Vector3(Math.sin(az) * rAtY, y, Math.cos(az) * rAtY));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      seamGroup.add(new THREE.Line(geo, seamMat));
    }
    seamGroup.visible = seamsVisible;
    scene.add(seamGroup);
    s.seamGroup = seamGroup;

    // Apply thumbnail texture
    const applyThumb = (day: number, img: HTMLImageElement) => {
      const meta = s.photoDataStore[day];
      const mesh = s.photoMeshesByDay[day];
      if (!meta || !mesh) return;
      meta.img = img;
      if (s.useFallback2D) return;

      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      meta.texture = tex;
      mesh.material = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      (mesh.material as THREE.Material).needsUpdate = true;
    };

    // Load thumbnails concurrently across the full sphere
    let isCancelled = false;
    const loadThumbs = async () => {
      const total = totalPhotos;
      if (photoFiles.length === 0) return;

      const loadedImgCache = new Map<string, HTMLImageElement>();
      let nextDayToLoad = 1;
      let done = 0;

      const loadOneTile = async (day: number) => {
        if (isCancelled) return;
        const file = getFilenameForDay(day);
        if (!file) return;

        let img = loadedImgCache.get(file);
        if (!img) {
          img = await new Promise<HTMLImageElement>((resolve) => {
            const imageEl = new Image();
            imageEl.decoding = 'async';
            imageEl.crossOrigin = 'anonymous';

            const primaryUrl = getPhotoUrl(baseUrl, 'thumbs', file, photoVersion);
            const fallbackUrl = getPhotoUrl(EXTERNAL_DOME_URL, 'thumbs', file, photoVersion);

            imageEl.onload = () => resolve(imageEl);
            imageEl.onerror = () => {
              if (imageEl.src !== fallbackUrl) {
                imageEl.src = fallbackUrl;
              } else {
                resolve(imageEl);
              }
            };
            imageEl.src = primaryUrl;
          });
          loadedImgCache.set(file, img);
        }

        if (!isCancelled && img && img.naturalWidth > 0) {
          applyThumb(day, img);
        }
      };

      const worker = async () => {
        while (nextDayToLoad <= total && !isCancelled) {
          const d = nextDayToLoad++;
          await loadOneTile(d);
          done++;
          if (done % 15 === 0 || done === total) {
            onLoadingProgress(done, total);
          }
        }
      };

      await Promise.all(Array.from({ length: 8 }, worker));
    };

    loadThumbs();

    // Shooting stars
    const spawnShootingStar = () => {
      const geo = new THREE.BufferGeometry();
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-14, -4, 0)];
      geo.setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const elev = -60 + Math.random() * 140;
      const dist = 180;
      line.position.set(Math.cos(angle) * dist, elev, Math.sin(angle) * dist);
      line.lookAt(0, 0, 0);
      scene.add(line);
      s.shootingStars.push({
        mesh: line,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 3.2,
          -0.8 - Math.random() * 0.8,
          (Math.random() - 0.5) * 3.2
        ),
        life: 1.0,
      });
    };

    // 2D Fallback Renderer
    const renderFallback2D = () => {
      const fCtx = s.fallbackCtx;
      const fCanvas = s.fallbackCanvas;
      if (!fCtx || !fCanvas) return;

      const w = fCanvas.width;
      const h = fCanvas.height;
      const halfW = w * 0.5;
      const halfH = h * 0.5;

      fCtx.fillStyle = '#03050c';
      fCtx.fillRect(0, 0, w, h);

      camera.updateMatrixWorld();
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const tempVec = new THREE.Vector3();

      s.fallbackStars.forEach((st) => {
        const phi = THREE.MathUtils.degToRad(90 - st.lat);
        const theta = THREE.MathUtils.degToRad(st.lon);
        tempVec.set(
          200 * Math.sin(phi) * Math.cos(theta),
          200 * Math.cos(phi),
          200 * Math.sin(phi) * Math.sin(theta)
        );
        const toStar = tempVec.clone().sub(camera.position);
        if (toStar.dot(camDir) > 0) {
          tempVec.project(camera);
          const sx = tempVec.x * halfW + halfW;
          const sy = -(tempVec.y * halfH) + halfH;
          if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) {
            fCtx.fillStyle = st.color;
            fCtx.beginPath();
            fCtx.arc(sx, sy, st.size, 0, Math.PI * 2);
            fCtx.fill();
          }
        }
      });

      const focalLength = halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const visibleTiles: Array<{
        day: number;
        meta: PhotoMeta;
        mesh: THREE.Mesh;
        dist: number;
        screenX: number;
        screenY: number;
        drawW: number;
        drawH: number;
      }> = [];

      for (let i = 0; i < s.allPhotoMeshes.length; i++) {
        const mesh = s.allPhotoMeshes[i];
        const day = mesh.userData.day;
        const meta = s.photoDataStore[day];
        if (!meta) continue;

        tempVec.copy(meta.position).sub(camera.position);
        const depth = tempVec.dot(camDir);
        if (depth <= 5) continue;
        const dist = tempVec.length();
        tempVec.copy(meta.position).project(camera);
        if (tempVec.x < -1.35 || tempVec.x > 1.35 || tempVec.y < -1.35 || tempVec.y > 1.35) continue;

        const screenX = tempVec.x * halfW + halfW;
        const screenY = -(tempVec.y * halfH) + halfH;
        const scaleFactor = focalLength / dist;
        const drawW = meta.tileW * scaleFactor;
        const drawH = meta.tileH * scaleFactor;

        visibleTiles.push({
          day,
          meta,
          mesh,
          dist,
          screenX,
          screenY,
          drawW,
          drawH,
        });
      }

      visibleTiles.sort((a, b) => b.dist - a.dist);
      for (let i = 0; i < visibleTiles.length; i++) {
        const item = visibleTiles[i];
        const tileCanvas = item.meta.img || s.placeholderCanvas;
        const x = item.screenX - item.drawW * 0.5;
        const y = item.screenY - item.drawH * 0.5;

        if (s.hoveredMesh === item.mesh) {
          fCtx.strokeStyle = '#fbbf24';
          fCtx.lineWidth = 3;
          fCtx.strokeRect(x - 3, y - 3, item.drawW + 6, item.drawH + 6);
        }
        if (tileCanvas) {
          fCtx.drawImage(tileCanvas, x, y, item.drawW, item.drawH);
        }
      }
    };

    // Animation Loop
    const lookAtTarget = new THREE.Vector3();
    const animate = () => {
      s.animFrameId = requestAnimationFrame(animate);

      if (!s.isPointerDown) {
        // Smooth inertial flick momentum with exponential friction decay
        if (Math.abs(s.velocityLon) > 0.004 || Math.abs(s.velocityLat) > 0.004) {
          s.targetLon += s.velocityLon;
          s.targetLat = Math.max(-89.5, Math.min(89.5, s.targetLat + s.velocityLat));
          s.velocityLon *= 0.93;
          s.velocityLat *= 0.93;
        } else {
          s.velocityLon = 0;
          s.velocityLat = 0;
          if (s.autoOrbit) {
            s.targetLon += 0.035 * (s.orbitSpeed ?? 1);
          }
        }
      }

      s.lon += (s.targetLon - s.lon) * 0.08;
      s.lat += (s.targetLat - s.lat) * 0.08;

      // Report celestial azimuth & elevation to telemetry readout
      if (onCoordinatesChange) {
        const curAzimuth = Math.round((((s.lon % 360) + 360) % 360));
        const curElevation = Math.round(s.lat);
        if (curAzimuth !== s.lastReportedAzimuth || curElevation !== s.lastReportedElevation) {
          s.lastReportedAzimuth = curAzimuth;
          s.lastReportedElevation = curElevation;
          onCoordinatesChange(curAzimuth, curElevation);
        }
      }

      if (Math.abs(s.targetFov - s.currentFov) > 0.01) {
        s.currentFov += (s.targetFov - s.currentFov) * 0.1;
        camera.fov = s.currentFov;
        camera.updateProjectionMatrix();
        onFovChange(s.currentFov);
      }

      const phi = THREE.MathUtils.degToRad(90 - s.lat);
      const theta = THREE.MathUtils.degToRad(s.lon);
      lookAtTarget.x = camera.position.x + 100 * Math.sin(phi) * Math.cos(theta);
      lookAtTarget.y = camera.position.y + 100 * Math.cos(phi);
      lookAtTarget.z = camera.position.z + 100 * Math.sin(phi) * Math.sin(theta);
      camera.lookAt(lookAtTarget);

      if (s.starSkyGroup) {
        s.starSkyGroup.rotation.y += 0.00015;
      }

      if (Math.random() < 0.015 && s.shootingStars.length < 4) {
        spawnShootingStar();
      }

      for (let i = s.shootingStars.length - 1; i >= 0; i--) {
        const str = s.shootingStars[i];
        str.mesh.position.add(str.vel);
        str.life -= 0.018;
        (str.mesh.material as THREE.LineBasicMaterial).opacity = Math.max(0, str.life);
        if (str.life <= 0) {
          scene.remove(str.mesh);
          str.mesh.geometry.dispose();
          (str.mesh.material as THREE.Material).dispose();
          s.shootingStars.splice(i, 1);
        }
      }

      if (renderer) {
        renderer.render(scene, camera);
      } else if (s.useFallback2D) {
        renderFallback2D();
      }
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (renderer) {
        renderer.setSize(w, h);
      }
      if (s.fallbackCanvas) {
        s.fallbackCanvas.width = w;
        s.fallbackCanvas.height = h;
      }
    };

    window.addEventListener('resize', handleResize);
    requestAnimationFrame(handleResize);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(s.animFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
      if (s.fallbackCanvas && container.contains(s.fallbackCanvas)) {
        container.removeChild(s.fallbackCanvas);
      }
      scene.clear();
    };
  }, [baseUrl, photoFiles, numRings, totalPhotos, loopMemories]);

  // Pointer Interaction
  const raycaster = useRef(new THREE.Raycaster());
  const pointerNDC = useRef(new THREE.Vector2());

  const pickTile = (clientX: number, clientY: number) => {
    const s = stateRef.current;
    if (!s.camera || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    pointerNDC.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(pointerNDC.current, s.camera);
    const hits = raycaster.current.intersectObjects(s.allPhotoMeshes);
    return hits.length ? (hits[0].object as THREE.Mesh) : null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    s.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    s.autoOrbit = false;
    s.velocityLon = 0;
    s.velocityLat = 0;
    s.lastPointerX = e.clientX;
    s.lastPointerY = e.clientY;
    s.lastPointerMoveTime = performance.now();
    onInteractionStart?.();

    if (s.activePointers.size === 1) {
      s.isPointerDown = true;
      s.pointerDownX = e.clientX;
      s.pointerDownY = e.clientY;
      s.pointerDownLon = s.targetLon;
      s.pointerDownLat = s.targetLat;
      s.dragDistance = 0;
      s.wasPinching = false;
    } else if (s.activePointers.size === 2) {
      s.isPointerDown = false;
      s.wasPinching = true;
      const [a, b] = Array.from(s.activePointers.values());
      s.pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      s.pinchStartFov = s.targetFov;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    const p = s.activePointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }

    if (s.activePointers.size === 2 && s.pinchStartDist) {
      const [a, b] = Array.from(s.activePointers.values());
      const currentDist = Math.hypot(a.x - b.x, a.y - b.y);
      const newFov = s.pinchStartFov * (s.pinchStartDist / Math.max(20, currentDist));
      s.targetFov = Math.max(16, Math.min(78, newFov));
      onFovChange(s.targetFov);
      return;
    }

    if (s.isPointerDown && s.activePointers.size === 1) {
      const now = performance.now();
      const dt = Math.max(1, now - s.lastPointerMoveTime);
      const dxFromLast = e.clientX - s.lastPointerX;
      const dyFromLast = e.clientY - s.lastPointerY;

      s.lastPointerX = e.clientX;
      s.lastPointerY = e.clientY;
      s.lastPointerMoveTime = now;

      const dx = e.clientX - s.pointerDownX;
      const dy = e.clientY - s.pointerDownY;
      s.dragDistance = Math.hypot(dx, dy);
      const sensitivity = s.currentFov / (e.pointerType === 'mouse' ? 420 : 360);
      s.targetLon = s.pointerDownLon - dx * sensitivity;
      s.targetLat = Math.max(-89.5, Math.min(89.5, s.pointerDownLat + dy * sensitivity));

      // Calculate instantaneous fling velocity
      if (dt < 120) {
        const frameNorm = dt / 16.6;
        const instantVelLon = -(dxFromLast * sensitivity) / Math.max(0.5, frameNorm);
        const instantVelLat = (dyFromLast * sensitivity) / Math.max(0.5, frameNorm);
        s.velocityLon = s.velocityLon * 0.35 + instantVelLon * 0.65;
        s.velocityLat = s.velocityLat * 0.35 + instantVelLat * 0.65;
      }
    } else if (e.pointerType === 'mouse' && s.activePointers.size === 0) {
      const mesh = pickTile(e.clientX, e.clientY);
      setHoveredTile(mesh);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    const wasTap =
      s.isPointerDown &&
      s.activePointers.size === 1 &&
      s.dragDistance < 8 &&
      !s.wasPinching;

    const timeSinceLastMove = performance.now() - s.lastPointerMoveTime;
    if (wasTap || timeSinceLastMove > 80) {
      s.velocityLon = 0;
      s.velocityLat = 0;
    } else {
      // Clamp fling momentum to smooth comfortable range
      s.velocityLon = Math.max(-3.0, Math.min(3.0, s.velocityLon));
      s.velocityLat = Math.max(-1.8, Math.min(1.8, s.velocityLat));
    }

    s.activePointers.delete(e.pointerId);
    if (s.activePointers.size < 2) s.pinchStartDist = null;
    if (s.activePointers.size === 0) s.isPointerDown = false;

    if (wasTap) {
      const mesh = pickTile(e.clientX, e.clientY);
      if (mesh && mesh.userData && mesh.userData.day) {
        onSelectPhoto(mesh.userData.day);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const s = stateRef.current;
    const newFov = s.targetFov + e.deltaY * 0.04;
    s.targetFov = Math.max(16, Math.min(78, newFov));
    onFovChange(s.targetFov);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      className="fixed inset-0 w-full h-full z-0 touch-none cursor-grab active:cursor-grabbing select-none overflow-hidden"
      style={{ background: '#03050c' }}
    />
  );
};

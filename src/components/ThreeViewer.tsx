import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  Maximize2,
  RotateCcw,
  Ruler,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { BuiltModuleResult } from '../types/furniture';
import { getThreeMaterial } from '../utils/materials';
import { R, R1 } from '../utils/woodworking-math';

interface ThreeViewerProps {
  modules: BuiltModuleResult[];
  activeSourceLabel: string;
  isLightMode?: boolean;
}

interface InspectedPartInfo {
  code?: string;
  name: string;
  matName: string;
  L: number;
  l: number;
  bt: number;
  cut: string;
}

function makeDimensionSprite(text: string, isLight: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.9)' : 'rgba(245, 158, 11, 0.95)';
  ctx.beginPath();
  ctx.roundRect(16, 12, 288, 56, 12);
  ctx.fill();

  ctx.font = 'bold 28px "JetBrains Mono", monospace';
  ctx.fillStyle = isLight ? '#ffffff' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 41);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(280, 70, 1);
  return sprite;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
  modules,
  activeSourceLabel,
  isLightMode = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const dimGroupRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const animFrameRef = useRef<number>(0);

  const [sceneReady, setSceneReady] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Interaction controls
  const [doorOpen, setDoorOpen] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState<number>(0);
  const [exploded, setExploded] = useState<number>(0);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [inspectedPart, setInspectedPart] = useState<InspectedPartInfo | null>(null);

  // Camera state
  const targetAzimuth = useRef<number>(0.68);
  const targetElevation = useRef<number>(0.36);
  const currentAzimuth = useRef<number>(0.68);
  const currentElevation = useRef<number>(0.36);
  const targetZoom = useRef<number>(1.0);
  const currentZoom = useRef<number>(1.0);
  const panOffset = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const centerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 1000, 0));
  const sceneSpan = useRef<number>(2000);

  // Pointer drag state
  const isPointerDown = useRef<boolean>(false);
  const isPanning = useRef<boolean>(false);
  const downPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const prevPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);

  // 1. Setup Three.js Scene FIRST so refs exist before mesh building
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    let renderer: THREE.WebGLRenderer;
    try {
      const isSoftwareGl = (() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
        alpha: false,
      });
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (err: any) {
      setWebglError(err?.message || 'Contexte WebGL indisponible sur ce navigateur.');
      return;
    }

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const bgHex = isLightMode ? 0xe8eef5 : 0x0f172a;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.00012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 5, 80000);
    cameraRef.current = camera;

    // Lighting rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, isLightMode ? 0x94a3b8 : 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.15);
    keyLight.position.set(2200, 3800, 3000);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    fillLight.position.set(-2200, 1600, -2000);
    scene.add(fillLight);

    // Subtle studio floor grid
    const floorGrid = new THREE.GridHelper(
      8000,
      80,
      isLightMode ? 0x94a3b8 : 0x334155,
      isLightMode ? 0xcbd5e1 : 0x1e293b
    );
    floorGrid.position.y = -2;
    scene.add(floorGrid);
    gridRef.current = floorGrid;

    const rootGroup = new THREE.Group();
    rootGroup.scale.z = -1; // Front face oriented cleanly toward +Z camera
    scene.add(rootGroup);
    groupRef.current = rootGroup;

    const dimGroup = new THREE.Group();
    scene.add(dimGroup);
    dimGroupRef.current = dimGroup;

    setSceneReady(true);

    const dom = renderer.domElement;
    const raycaster = new THREE.Raycaster();

    const handlePointerDown = (e: PointerEvent) => {
      dom.setPointerCapture(e.pointerId);
      isPointerDown.current = true;
      isPanning.current = e.button === 2 || e.shiftKey;
      downPos.current = { x: e.clientX, y: e.clientY };
      prevPointer.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDown.current) return;
      const dx = e.clientX - prevPointer.current.x;
      const dy = e.clientY - prevPointer.current.y;
      prevPointer.current = { x: e.clientX, y: e.clientY };

      if (isPanning.current) {
        const panSpeed = sceneSpan.current * 0.0015 * currentZoom.current;
        const right = new THREE.Vector3(
          Math.cos(currentAzimuth.current),
          0,
          -Math.sin(currentAzimuth.current)
        );
        panOffset.current.addScaledVector(right, -dx * panSpeed);
        panOffset.current.y += dy * panSpeed;
      } else {
        targetAzimuth.current -= dx * 0.008;
        targetElevation.current = Math.max(
          -1.35,
          Math.min(1.4, targetElevation.current + dy * 0.008)
        );
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      isPointerDown.current = false;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}

      const moveDist = Math.hypot(
        e.clientX - downPos.current.x,
        e.clientY - downPos.current.y
      );
      if (moveDist < 5 && e.button === 0 && groupRef.current && cameraRef.current) {
        const rect = dom.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, cameraRef.current);
        const meshes: THREE.Object3D[] = [];
        groupRef.current.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh && obj.userData?.partName) {
            meshes.push(obj);
          }
        });
        const hits = raycaster.intersectObjects(meshes, false);

        // Reset previous highlight
        if (selectedMeshRef.current) {
          const prevMat = selectedMeshRef.current.material as THREE.MeshStandardMaterial;
          if (prevMat?.emissive) prevMat.emissive.setHex(0x000000);
          selectedMeshRef.current = null;
        }

        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const hitMat = hitMesh.material as THREE.MeshStandardMaterial;
          if (hitMat?.emissive) {
            hitMat.emissive.setHex(0xd97706);
            hitMat.emissiveIntensity = 0.25;
          }
          selectedMeshRef.current = hitMesh;
          setInspectedPart(hitMesh.userData.partInfo || null);
        } else {
          setInspectedPart(null);
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom.current = Math.max(
        0.3,
        Math.min(4.0, targetZoom.current * (1 + e.deltaY * 0.001))
      );
    };

    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('contextmenu', handleContextMenu);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(entry.contentRect.width, 1);
      const h = Math.max(entry.contentRect.height, 1);
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);

      currentAzimuth.current += (targetAzimuth.current - currentAzimuth.current) * 0.14;
      currentElevation.current += (targetElevation.current - currentElevation.current) * 0.14;
      currentZoom.current += (targetZoom.current - currentZoom.current) * 0.14;

      const d = sceneSpan.current * 2.15 * currentZoom.current;
      const ctr = centerPos.current.clone().add(panOffset.current);

      camera.position.set(
        ctr.x + d * Math.cos(currentElevation.current) * Math.sin(currentAzimuth.current),
        ctr.y + d * Math.sin(currentElevation.current),
        ctr.z + d * Math.cos(currentElevation.current) * Math.cos(currentAzimuth.current)
      );
      camera.lookAt(ctr);

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      setSceneReady(false);
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('contextmenu', handleContextMenu);
      dom.removeEventListener('wheel', handleWheel);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 2. Sync Light/Dark 3D Studio Environment smoothly without rebuilding meshes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const bgHex = isLightMode ? 0xe8eef5 : 0x0f172a;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.00012);

    if (gridRef.current) {
      scene.remove(gridRef.current);
      const nextGrid = new THREE.GridHelper(
        8000,
        80,
        isLightMode ? 0x94a3b8 : 0x334155,
        isLightMode ? 0xcbd5e1 : 0x1e293b
      );
      nextGrid.position.y = -2;
      scene.add(nextGrid);
      gridRef.current = nextGrid;
    }
  }, [isLightMode]);

  // 3. Build 3D Meshes whenever modules or sceneReady change
  useEffect(() => {
    if (!sceneReady || !groupRef.current || !sceneRef.current) return;
    const rootGroup = groupRef.current;

    while (rootGroup.children.length > 0) {
      const child = rootGroup.children[0];
      rootGroup.remove(child);
      child.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    selectedMeshRef.current = null;
    setInspectedPart(null);

    if (!modules.length) return;

    modules.forEach((M) => {
      const moduleGroup = new THREE.Group();
      const mt = M.mt || {
        th: 0,
        X0: 0,
        Y0: 0,
        Z0: 0,
      };

      moduleGroup.rotation.y = -mt.th;
      moduleGroup.position.set(mt.X0, mt.Z0, mt.Y0);

      M.P.forEach((p) => {
        try {
          let geo: THREE.BufferGeometry;
          const pos = new THREE.Vector3();
          const mat = getThreeMaterial(
            p.colorHex || '#d8ba8e',
            p.woodGrain ?? true,
            p.roughness ?? 0.65,
            p.metalness ?? 0.03,
            p.role === 'fond'
          );

          const fin = () => {
            geo.computeBoundingBox();
            if (geo.boundingBox) {
              geo.boundingBox.getCenter(pos);
              geo.translate(-pos.x, -pos.y, -pos.z);
            }
          };

          if (p.obl) {
            const o = p.obl;
            const sh = new THREE.Shape(
              o.pts.map((a: any) => new THREE.Vector2(a[0], o.zhi - a[1]))
            );
            geo = new THREE.ExtrudeGeometry(sh, {
              depth: Math.max(0.8, o.th - 0.6),
              bevelEnabled: false,
            });
            const M_mat = new THREE.Matrix4();
            M_mat.makeBasis(
              new THREE.Vector3(Math.cos(o.ang), 0, Math.sin(o.ang)),
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(-Math.sin(o.ang), 0, Math.cos(o.ang))
            );
            geo.applyMatrix4(M_mat);
            geo.translate(o.x0, 0, o.y0);
            fin();
          } else if (p.til) {
            const T = p.til;
            const sh = new THREE.Shape(
              p.pl!.map((a: any) => new THREE.Vector2(a[0], a[1]))
            );
            geo = new THREE.ExtrudeGeometry(sh, {
              depth: Math.max(0.8, p.th - 0.6),
              bevelEnabled: false,
            });
            const M_mat = new THREE.Matrix4();
            M_mat.makeBasis(
              new THREE.Vector3(T.cs, Math.sin(T.ang), 0),
              new THREE.Vector3(0, 0, 1),
              new THREE.Vector3(-Math.sin(T.ang), T.cs, 0)
            );
            geo.applyMatrix4(M_mat);
            geo.translate(T.x0, T.za, T.y0);
            fin();
          } else if (p.poly) {
            const i = [0, 1, 2].filter((k) => k !== p.a);
            const sh = new THREE.Shape(
              p.poly.map((a: any) => new THREE.Vector2(a[i[0]], a[i[1]]))
            );
            geo = new THREE.ExtrudeGeometry(sh, {
              depth: Math.max(0.8, p.th - 0.6),
              bevelEnabled: false,
            });
            geo.translate(0, 0, p.min[p.a] + 0.3);
            const v3 = (ax: number) =>
              ax === 0
                ? new THREE.Vector3(1, 0, 0)
                : ax === 1
                ? new THREE.Vector3(0, 0, 1)
                : new THREE.Vector3(0, 1, 0);
            const M_mat = new THREE.Matrix4();
            M_mat.makeBasis(v3(i[0]), v3(i[1]), v3(p.a));
            geo.applyMatrix4(M_mat);
            fin();
          } else {
            const b = p.v || p;
            const m = b.min;
            const s = b.size;
            geo = new THREE.BoxGeometry(
              Math.max(1, s[0] - 0.6),
              Math.max(1, s[2] - 0.6),
              Math.max(1, s[1] - 0.6)
            );
            pos.set(m[0] + s[0] / 2, m[2] + s[2] / 2, m[1] + s[1] / 2);
          }

          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({
              color: isLightMode ? 0x334155 : 0x1e293b,
              transparent: true,
              opacity: isLightMode ? 0.45 : 0.6,
            })
          );
          mesh.add(edges);

          mesh.position.copy(pos);
          mesh.userData.dr = p.dr;
          mesh.userData.dwr = p.dwr;
          mesh.userData.partName = p.name;
          mesh.userData.partCode = p.code;
          mesh.userData.partInfo = {
            code: p.code,
            name: p.name,
            matName: p.matName || p.mat,
            L: R(p.L),
            l: R(p.l),
            bt: R1(p.bt),
            cut: p.cut,
          };

          moduleGroup.add(mesh);
        } catch {
          // Ignore malformed polygon edge case so other panels keep rendering
        }
      });

      // Hanging rods
      (M.rods || []).forEach((r) => {
        const rodGeo = new THREE.CylinderGeometry(r.d / 2, r.d / 2, Math.max(10, r.x1 - r.x0), 24);
        rodGeo.rotateZ(Math.PI / 2);
        const rodMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          metalness: 0.85,
          roughness: 0.2,
        });
        const rodMesh = new THREE.Mesh(rodGeo, rodMat);
        rodMesh.position.set((r.x0 + r.x1) / 2, r.z, r.y);
        moduleGroup.add(rodMesh);
      });

      rootGroup.add(moduleGroup);
    });

    rootGroup.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(rootGroup);
    const sz = bbox.getSize(new THREE.Vector3());
    centerPos.current = bbox.getCenter(new THREE.Vector3());
    sceneSpan.current = Math.max(sz.x, sz.y, sz.z, 600);
    panOffset.current.set(0, 0, 0);

    rootGroup.children.forEach((modG) => {
      modG.children.forEach((m) => {
        m.userData.w = m.getWorldPosition(new THREE.Vector3());
        m.userData.lp = m.position.clone();
      });
    });

    // Rebuild overall dimension helpers
    if (dimGroupRef.current) {
      const dg = dimGroupRef.current;
      while (dg.children.length > 0) {
        const c = dg.children[0];
        dg.remove(c);
      }
      if (showDimensions && !bbox.isEmpty()) {
        const pad = 70;
        const lineMat = new THREE.LineBasicMaterial({
          color: isLightMode ? 0x0f172a : 0xf59e0b,
          transparent: true,
          opacity: 0.85,
        });

        // Width line under front
        const wPts = [
          new THREE.Vector3(bbox.min.x, bbox.min.y - pad, bbox.max.z + pad),
          new THREE.Vector3(bbox.max.x, bbox.min.y - pad, bbox.max.z + pad),
        ];
        dg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wPts), lineMat));
        const wSprite = makeDimensionSprite(`${R(sz.x)} mm`, isLightMode);
        wSprite.position.set((bbox.min.x + bbox.max.x) / 2, bbox.min.y - pad - 45, bbox.max.z + pad);
        dg.add(wSprite);

        // Height line on right
        const hPts = [
          new THREE.Vector3(bbox.max.x + pad, bbox.min.y, bbox.max.z),
          new THREE.Vector3(bbox.max.x + pad, bbox.max.y, bbox.max.z),
        ];
        dg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPts), lineMat));
        const hSprite = makeDimensionSprite(`${R(sz.y)} mm`, isLightMode);
        hSprite.position.set(bbox.max.x + pad + 140, (bbox.min.y + bbox.max.y) / 2, bbox.max.z);
        dg.add(hSprite);

        // Depth line on side
        const dPts = [
          new THREE.Vector3(bbox.max.x + pad, bbox.min.y, bbox.min.z),
          new THREE.Vector3(bbox.max.x + pad, bbox.min.y, bbox.max.z),
        ];
        dg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(dPts), lineMat));
        const dSprite = makeDimensionSprite(`${R(sz.z)} mm`, isLightMode);
        dSprite.position.set(bbox.max.x + pad + 120, bbox.min.y - 35, (bbox.min.z + bbox.max.z) / 2);
        dg.add(dSprite);
      }
    }
  }, [modules, sceneReady, showDimensions, isLightMode]);

  // 4. Kinematic updates (Doors, Drawers, Explosion, Wireframe)
  useEffect(() => {
    if (!groupRef.current) return;
    const root = groupRef.current;
    const ctr = centerPos.current;
    const e = (exploded / 100) * 1.35;
    const po = doorOpen / 100;
    const to = drawerOpen / 100;

    root.children.forEach((modG) => {
      modG.children.forEach((m) => {
        const u = m.userData;
        if (!u.w || !u.lp) return;

        const w = u.w.clone().sub(ctr).multiplyScalar(1 + e).add(ctr);
        modG.worldToLocal(w);
        m.position.copy(w);
        m.rotation.y = 0;

        const dx = w.x - u.lp.x;
        const dz = w.z - u.lp.z;

        if (u.dwr && to > 0) {
          m.position.z -= u.dwr.d * to;
        }

        if (u.dr && po > 0) {
          const th = po * 1.83 * (u.dr.h === 'L' ? 1 : -1);
          const px = u.dr.px + dx;
          const pz = u.dr.pz + dz;
          const cx = m.position.x - px;
          const cz = m.position.z - pz;
          m.position.x = px + cx * Math.cos(th) + cz * Math.sin(th);
          m.position.z = pz - cx * Math.sin(th) + cz * Math.cos(th);
          m.rotation.y = th;
        }

        if ((m as any).material) {
          (m as any).material.wireframe = wireframeMode;
        }
      });
    });
  }, [doorOpen, drawerOpen, exploded, wireframeMode, modules, sceneReady]);

  const setCameraPreset = (az: number, el: number) => {
    targetAzimuth.current = az;
    targetElevation.current = el;
    targetZoom.current = 1.0;
    panOffset.current.set(0, 0, 0);
  };

  const captureSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vue-3d-mobilier-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-[640px] lg:h-[740px] rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-950 shadow-2xl">
      {/* 3D Canvas Mount Point */}
      {webglError ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-2">
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
            Rendu WebGL 3D indisponible
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">{webglError}</p>
        </div>
      ) : (
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      )}

      {/* Top Floating HUD */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[calc(100%-10rem)]">
        <div className="flex flex-wrap items-center gap-2.5 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700/60 shadow-lg text-xs">
          <span className="font-bold text-amber-700 dark:text-amber-400">Atelier 3D</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium">{activeSourceLabel}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600 dark:text-slate-400 font-mono">
            {modules.reduce((acc, m) => acc + m.P.length, 0)} pièces
          </span>
        </div>

        {inspectedPart && (
          <div className="flex items-start justify-between gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-lg border border-amber-500 shadow-xl text-xs">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  {inspectedPart.code || 'Pièce'}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {inspectedPart.name}
                </span>
              </div>
              <span className="text-slate-600 dark:text-slate-300">{inspectedPart.matName}</span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {inspectedPart.L} × {inspectedPart.l} × {inspectedPart.bt} mm · Coupe {inspectedPart.cut}
              </span>
            </div>
            <button
              onClick={() => setInspectedPart(null)}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Top-Right Quick Actions */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          onClick={() => targetZoom.current = Math.max(0.3, targetZoom.current * 0.82)}
          title="Zoom avant"
          className="p-2 rounded-lg border bg-white/90 dark:bg-slate-900/85 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => targetZoom.current = Math.min(4.0, targetZoom.current * 1.2)}
          title="Zoom arrière"
          className="p-2 rounded-lg border bg-white/90 dark:bg-slate-900/85 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowDimensions(!showDimensions)}
          title="Afficher / masquer cotes 3D"
          className={`p-2 rounded-lg border shadow transition-colors ${
            showDimensions
              ? 'bg-amber-500 text-slate-950 border-amber-600'
              : 'bg-white/90 dark:bg-slate-900/85 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Ruler className="w-4 h-4" />
        </button>
        <button
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Mode filaire / ombré"
          className={`p-2 rounded-lg border shadow transition-colors ${
            wireframeMode
              ? 'bg-amber-500 text-slate-950 border-amber-600'
              : 'bg-white/90 dark:bg-slate-900/85 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={captureSnapshot}
          title="Télécharger une capture PNG"
          className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-900/85 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg shadow transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">Capture</span>
        </button>
      </div>

      {/* Bottom Collapsible Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl">
        <div className="flex justify-center mb-1.5">
          <button
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-full text-xs font-medium shadow-md transition-all"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Afficher les commandes 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Masquer les commandes</span>
              </>
            )}
          </button>
        </div>

        {!isDockCollapsed && (
          <div className="bg-white/95 dark:bg-slate-900/92 border border-slate-300 dark:border-slate-800 backdrop-blur-md rounded-xl p-4 shadow-2xl flex flex-col gap-3">
            {/* Row 1: Kinematic Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Ouverture Portes</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{doorOpen}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={doorOpen}
                  onChange={(e) => setDoorOpen(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Sortie Tiroirs</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{drawerOpen}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={drawerOpen}
                  onChange={(e) => setDrawerOpen(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Vue Éclatée</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{exploded}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={exploded}
                  onChange={(e) => setExploded(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            {/* Row 2: Camera Presets & Fast Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mr-1">Vues :</span>
                <button
                  onClick={() => setCameraPreset(0, 0.05)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded border border-slate-300 dark:border-slate-700 font-medium"
                >
                  Face
                </button>
                <button
                  onClick={() => setCameraPreset(-Math.PI / 2, 0.05)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded border border-slate-300 dark:border-slate-700 font-medium"
                >
                  Profil G
                </button>
                <button
                  onClick={() => setCameraPreset(Math.PI / 2, 0.05)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded border border-slate-300 dark:border-slate-700 font-medium"
                >
                  Profil D
                </button>
                <button
                  onClick={() => setCameraPreset(0, 1.38)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded border border-slate-300 dark:border-slate-700 font-medium"
                >
                  Dessus
                </button>
                <button
                  onClick={() => setCameraPreset(0.68, 0.36)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-xs rounded border border-amber-500/40 font-semibold"
                >
                  3/4 Recentrer
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-[11px] text-slate-500 dark:text-slate-400">
                  Clic: inspecter · Glisser: tourner · Clic droit: déplacer
                </span>
                <button
                  onClick={() => {
                    setDoorOpen(100);
                    setDrawerOpen(100);
                  }}
                  className="px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700 font-medium"
                >
                  Tout ouvrir
                </button>
                <button
                  onClick={() => {
                    setDoorOpen(0);
                    setDrawerOpen(0);
                    setExploded(0);
                  }}
                  className="px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700 font-medium"
                >
                  Tout refermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

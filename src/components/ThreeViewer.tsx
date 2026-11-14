import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Camera, ChevronDown, ChevronUp, Download, Eye, Maximize2, RotateCcw } from 'lucide-react';
import { BuiltModuleResult } from '../types/furniture';
import { getThreeMaterial } from '../utils/materials';

interface ThreeViewerProps {
  modules: BuiltModuleResult[];
  activeSourceLabel: string;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({ modules, activeSourceLabel }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);

  // Interaction controls
  const [doorOpen, setDoorOpen] = useState<number>(0); // 0 to 100%
  const [drawerOpen, setDrawerOpen] = useState<number>(0); // 0 to 100%
  const [exploded, setExploded] = useState<number>(0); // 0 to 100%
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);

  // Camera angles
  const targetAzimuth = useRef<number>(0.75);
  const targetElevation = useRef<number>(0.4);
  const currentAzimuth = useRef<number>(0.75);
  const currentElevation = useRef<number>(0.4);
  const currentZoom = useRef<number>(1.0);
  const centerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const sceneSpan = useRef<number>(1500);

  // Pointer drag state
  const isPointerDown = useRef<boolean>(false);
  const prevPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Re-build 3D Meshes whenever modules change
  useEffect(() => {
    if (!groupRef.current || !sceneRef.current) return;
    const rootGroup = groupRef.current;

    // Clear old children
    while (rootGroup.children.length > 0) {
      const child = rootGroup.children[0];
      rootGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

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
          geo = new THREE.ExtrudeGeometry(sh, { depth: o.th - 0.6, bevelEnabled: false });
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
          geo = new THREE.ExtrudeGeometry(sh, { depth: p.th - 0.6, bevelEnabled: false });
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
          geo = new THREE.ExtrudeGeometry(sh, { depth: p.th - 0.6, bevelEnabled: false });
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

        // Subtle dark chamfer edge wire
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0x1e293b,
            linewidth: 1,
            transparent: true,
            opacity: 0.6,
          })
        );
        mesh.add(edges);

        mesh.position.copy(pos);
        mesh.userData.dr = p.dr;
        mesh.userData.dwr = p.dwr;
        mesh.userData.partName = p.name;
        mesh.userData.partCode = p.code;

        moduleGroup.add(mesh);
      });

      // Hanging rods
      (M.rods || []).forEach((r) => {
        const rodGeo = new THREE.CylinderGeometry(r.d / 2, r.d / 2, r.x1 - r.x0, 24);
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
    sceneSpan.current = Math.max(sz.x, sz.y, sz.z, 500);

    // Save world positions for explosion and kinematics
    rootGroup.children.forEach((modG) => {
      modG.children.forEach((m) => {
        m.userData.w = m.getWorldPosition(new THREE.Vector3());
        m.userData.lp = m.position.clone();
      });
    });
  }, [modules]);

  // Main Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep modern dark studio background
    scene.fog = new THREE.FogExp2(0x0f172a, 0.00018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 5, 80000);
    cameraRef.current = camera;

    // Lighting rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
    keyLight.position.set(2000, 3500, 2800);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xcfd8dc, 0.5);
    fillLight.position.set(-2000, 1500, -2000);
    scene.add(fillLight);

    // Subtle contact floor grid
    const floorGrid = new THREE.GridHelper(6000, 60, 0x334155, 0x1e293b);
    floorGrid.position.y = -2;
    scene.add(floorGrid);

    const rootGroup = new THREE.Group();
    rootGroup.scale.z = -1; // Align Three coordinate convention with workshop front face
    scene.add(rootGroup);
    groupRef.current = rootGroup;

    // Pointer event handlers for custom smooth Orbiting
    const dom = renderer.domElement;
    const handlePointerDown = (e: PointerEvent) => {
      dom.setPointerCapture(e.pointerId);
      isPointerDown.current = true;
      prevPointer.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDown.current) return;
      const dx = e.clientX - prevPointer.current.x;
      const dy = e.clientY - prevPointer.current.y;
      prevPointer.current = { x: e.clientX, y: e.clientY };

      targetAzimuth.current -= dx * 0.008;
      targetElevation.current = Math.max(
        -1.35,
        Math.min(1.4, targetElevation.current + dy * 0.008)
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      isPointerDown.current = false;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      currentZoom.current = Math.max(
        0.35,
        Math.min(4.0, currentZoom.current * (1 + e.deltaY * 0.001))
      );
    };

    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // Handle Resize
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop with exponential damping
    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);

      // Smooth camera interpolation
      currentAzimuth.current += (targetAzimuth.current - currentAzimuth.current) * 0.12;
      currentElevation.current +=
        (targetElevation.current - currentElevation.current) * 0.12;

      const d = sceneSpan.current * 2.2 * currentZoom.current;
      const ctr = centerPos.current;

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
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Kinematic updates (Doors, Drawers, Explosion)
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

        // Exploded view offset
        const w = u.w.clone().sub(ctr).multiplyScalar(1 + e).add(ctr);
        modG.worldToLocal(w);
        m.position.copy(w);
        m.rotation.y = 0;

        const dx = w.x - u.lp.x;
        const dz = w.z - u.lp.z;

        // Drawer sliding kinematics
        if (u.dwr && to > 0) {
          m.position.z -= u.dwr.d * to;
        }

        // Door pivot rotation kinematics (up to 105 degrees swing)
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

        // Wireframe toggle
        if ((m as any).material) {
          (m as any).material.wireframe = wireframeMode;
        }
      });
    });
  }, [doorOpen, drawerOpen, exploded, wireframeMode]);

  // Camera Presets
  const setCameraPreset = (az: number, el: number) => {
    targetAzimuth.current = az;
    targetElevation.current = el;
    currentZoom.current = 1.0;
  };

  // Snapshot exporter
  const captureSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vue-3d-mobilier-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-[640px] lg:h-[720px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating HUD: Specs & Source */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-700/60 shadow-lg text-xs">
        <span className="font-semibold text-amber-400">Atelier 3D</span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-300 font-medium">{activeSourceLabel}</span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400 font-mono">
          {modules.reduce((acc, m) => acc + m.P.length, 0)} pièces
        </span>
      </div>

      {/* Top-Right Quick Action: Snapshot */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Mode filaire / ombré"
          className={`p-2 rounded-lg border transition-colors ${
            wireframeMode
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={captureSnapshot}
          title="Télécharger une photo HD du meuble"
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs font-medium rounded-lg shadow-lg transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span>Capture 3D</span>
        </button>
      </div>

      {/* Bottom Collapsible Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-4xl">
        <div className="flex justify-center mb-1.5">
          <button
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-slate-700/70 text-slate-300 hover:text-white rounded-full text-xs font-medium shadow-md transition-all"
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
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-xl p-4 shadow-2xl flex flex-col gap-3">
            {/* Row 1: Kinematic Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-medium">Ouverture Portes</span>
                  <span className="font-mono text-amber-400">{doorOpen}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={doorOpen}
                  onChange={(e) => setDoorOpen(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-medium">Sortie Tiroirs</span>
                  <span className="font-mono text-amber-400">{drawerOpen}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={drawerOpen}
                  onChange={(e) => setDrawerOpen(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-medium">Vue Éclatée</span>
                  <span className="font-mono text-amber-400">{exploded}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={exploded}
                  onChange={(e) => setExploded(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            {/* Row 2: Camera Presets & Fast Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Vues :</span>
                <button
                  onClick={() => setCameraPreset(0, 0.05)}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors"
                >
                  Face
                </button>
                <button
                  onClick={() => setCameraPreset(-Math.PI / 2, 0.05)}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors"
                >
                  Profil G
                </button>
                <button
                  onClick={() => setCameraPreset(Math.PI / 2, 0.05)}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors"
                >
                  Profil D
                </button>
                <button
                  onClick={() => setCameraPreset(0, 1.45)}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors"
                >
                  Dessus
                </button>
                <button
                  onClick={() => setCameraPreset(0.75, 0.4)}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs rounded border border-amber-500/30 transition-colors font-medium"
                >
                  Perspective 3/4
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDoorOpen(100);
                    setDrawerOpen(100);
                  }}
                  className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700 transition-colors"
                >
                  Tout ouvrir
                </button>
                <button
                  onClick={() => {
                    setDoorOpen(0);
                    setDrawerOpen(0);
                    setExploded(0);
                  }}
                  className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700 transition-colors"
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

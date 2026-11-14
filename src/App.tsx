import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderOpen,
  Moon,
  Redo,
  Save,
  Sun,
  Undo,
} from 'lucide-react';

import {
  AssemblyPlacement,
  BuiltModuleResult,
  CompartmentNode,
  FullProject,
  LibraryItem,
  ModuleConfig,
  PartPiece,
} from './types/furniture';
import {
  DEFAULT_CONFIG,
  migrateModuleConfig,
  PRESET_LIBRARY,
  syncDerivedConfig,
} from './data/presets';
import {
  buildModule,
  createGrid,
  getNode,
  getPlacementTransform,
  mkcs,
  R,
  R1,
} from './utils/woodworking-math';
import { computeNesting } from './utils/nesting';

import { ModuleConfigurator } from './components/ModuleConfigurator';
import { SchematicEditor } from './components/SchematicEditor';
import { ThreeViewer } from './components/ThreeViewer';
import { NestingViewer } from './components/NestingViewer';
import { NomenclatureTable } from './components/NomenclatureTable';
import { MachiningCards } from './components/MachiningCards';
import { AssemblyManager } from './components/AssemblyManager';
import { AutoSplitter } from './components/AutoSplitter';

export interface UniqueNomenclatureGroup {
  code: string;
  p: PartPiece;
  q: number;
  names: string[];
  instanceCodes: string[];
  placed: number;
}

// Zone code: 1 = Caisson, 2 = Intérieur, 3 = Fond, 4 = Extérieur
function getPartZone(p: PartPiece): 1 | 2 | 3 | 4 {
  if (p.role === 'corps') return 1;
  if (p.role === 'interieur' || p.role === 'tiroirs') return 2;
  if (p.role === 'fond') return 3;
  return 4;
}

// Position code: 1 = Vertical, 2 = Horizontal, 3 = Autre (frontal / plinthe / incliné / oblique)
function getPartPosition(p: PartPiece): 1 | 2 | 3 {
  if (p.a === 2 && !p.til) return 2;
  if (
    !p.til &&
    !p.obl &&
    (p.a === 0 ||
      (p.role === 'fond' && !p.poly) ||
      (p.role === 'facades' && /Porte|Fileur/.test(p.name)))
  ) {
    return 1;
  }
  return 3;
}

// Convert 0 -> 'a', 1 -> 'b', 2 -> 'c', ..., 26 -> 'aa'
function indexToLetters(idx: number): string {
  let n = idx;
  let res = '';
  do {
    res = String.fromCharCode(97 + (n % 26)) + res;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return res;
}

export default function App() {
  // Theme: 'dark' (Atelier) or 'light' (Mode Soleil)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('atelier_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('atelier_theme', theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  // Navigation Tabs: 0: Dimensions | 1: Séparation | 2: Aménagement | 3: Armoire | 4: Vue 3D | 5: Calepinage | 6: Nomenclature & Usinages
  const [activeTab, setActiveTab] = useState<number>(0);

  // Active module configuration and compartment tree
  const [config, setConfig] = useState<ModuleConfig>(DEFAULT_CONFIG);
  const [tree, setTree] = useState<CompartmentNode>(PRESET_LIBRARY[0].tree);
  const [editingLibraryIndex, setEditingLibraryIndex] = useState<number | null>(0);

  // Compartment selection & undo/redo history
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [multiSelectedPaths, setMultiSelectedPaths] = useState<string[]>([]);
  const [isMultiSelect, setIsMultiSelect] = useState<boolean>(false);
  const [selectedBoard, setSelectedBoard] = useState<{ path: number[]; index: number } | null>(
    null
  );
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Library of saved modules and Assembly of placed modules
  const [library, setLibrary] = useState<LibraryItem[]>(PRESET_LIBRARY);
  const [assembly, setAssembly] = useState<AssemblyPlacement[]>([
    {
      modId: 0,
      name: PRESET_LIBRARY[0].name,
      x: 0,
      z: 0,
      rot: 0,
      w: PRESET_LIBRARY[0].config.W,
      h: PRESET_LIBRARY[0].config.H,
    },
  ]);

  // Display Source: 'auto' | 'arm' | 'mod'
  const [viewSource, setViewSource] = useState<'auto' | 'arm' | 'mod'>('auto');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [nestingSeed, setNestingSeed] = useState<number>(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Push history state before changes
  const pushHistory = (currentTree: CompartmentNode) => {
    setUndoStack((prev) => [...prev.slice(-30), JSON.stringify(currentTree)]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.stringify(tree)]);
    setUndoStack((prev) => prev.slice(0, -1));
    setTree(JSON.parse(previous));
    setSelectedPath([]);
    showToast('Action annulée');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, JSON.stringify(tree)]);
    setRedoStack((prev) => prev.slice(0, -1));
    setTree(JSON.parse(next));
    setSelectedPath([]);
    showToast('Action rétablie');
  };

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName || '')
      ) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, tree]);

  // Build current module result (used for Configurator KPIs)
  const currentBuiltModule = useMemo(() => {
    return buildModule(config, tree);
  }, [config, tree]);

  const currentModuleAreaM2 = useMemo(() => {
    return currentBuiltModule.P.reduce(
      (acc, p) => acc + ((p.L * p.l) / 1_000_000) * (p.mult || 1),
      0
    );
  }, [currentBuiltModule]);

  // Build all assembled modules
  const shouldUseAssembly = viewSource === 'mod' ? false : assembly.length > 0;

  const builtModules: BuiltModuleResult[] = useMemo(() => {
    if (shouldUseAssembly) {
      return assembly.map((a, i) => {
        const libItem = library[a.modId] || { config, tree };
        const res = buildModule(libItem.config, libItem.tree);
        res.letter = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '');
        res.name = a.name;
        res.mt = getPlacementTransform(libItem.config, a.rot, a.x, a.z);
        res.P.forEach((p) => {
          p.M = i;
          p.letter = res.letter;
        });
        return res;
      });
    } else {
      const res = buildModule(config, tree);
      res.letter = 'A';
      res.name = config.name;
      res.mt = getPlacementTransform(config, 0, 0, 0);
      res.P.forEach((p) => {
        p.M = 0;
        p.letter = 'A';
      });
      return [res];
    }
  }, [shouldUseAssembly, assembly, library, config, tree]);

  // Assign structured atelier codes ([Module]-[Zone],[Position],[N°][lettre], e.g. B-1,2,1c)
  // deterministically before nesting & 3D rendering so every view displays identical codes.
  const { allPieces, baseGroups } = useMemo(() => {
    const pieces = builtModules.flatMap((m) => m.P);
    const groupMap: Record<
      string,
      {
        code: string;
        zone: 1 | 2 | 3 | 4;
        pos: 1 | 2 | 3;
        p: PartPiece;
        q: number;
        names: string[];
        pieces: PartPiece[];
      }
    > = {};
    const seqByModuleZonePos: Record<string, number> = {};
    const orderedGroups: typeof groupMap[string][] = [];

    pieces.forEach((p) => {
      const letter = p.letter || 'A';
      const zone = getPartZone(p);
      const pos = getPartPosition(p);
      const sig = [
        letter,
        zone,
        pos,
        R(p.L),
        R(p.l),
        R1(p.bt),
        p.mat,
        p.sheetL,
        p.sheetW,
        p.cut,
        p.pl ? JSON.stringify(p.pl.map((a) => a.map(R))) : '',
        JSON.stringify(
          p.h.map((h) => [
            h.k,
            h.e,
            R(h.u || 0),
            R(h.v || 0),
            R(h.pos || 0),
            h.d || 0,
            h.depth || 0,
          ])
        ),
        p.mult,
      ].join('|');

      if (!groupMap[sig]) {
        const prefixKey = `${letter}-${zone},${pos}`;
        seqByModuleZonePos[prefixKey] = (seqByModuleZonePos[prefixKey] || 0) + 1;
        const code = `${prefixKey},${seqByModuleZonePos[prefixKey]}`;
        groupMap[sig] = {
          code,
          zone,
          pos,
          p,
          q: 0,
          names: [],
          pieces: [],
        };
        orderedGroups.push(groupMap[sig]);
      }

      const g = groupMap[sig];
      g.q += p.mult || 1;
      if (!g.names.includes(p.name)) g.names.push(p.name);
      g.pieces.push(p);
      p.code = g.code;
    });

    // Sort instances within each identical group from left-to-right / bottom-to-top
    // and assign suffix letter (a, b, c...) when count > 1 (e.g. B-1,2,1c for the 3rd board)
    orderedGroups.forEach((g) => {
      g.pieces.sort((a, b) => {
        if (g.pos === 2) {
          // Horizontal pieces: bottom to top (Z), then left to right (X), then front to back (Y)
          if (Math.abs(a.min[2] - b.min[2]) > 0.5) return a.min[2] - b.min[2];
          if (Math.abs(a.min[0] - b.min[0]) > 0.5) return a.min[0] - b.min[0];
          return a.min[1] - b.min[1];
        }
        // Vertical & Other pieces: left to right (X), then bottom to top (Z), then front to back (Y)
        if (Math.abs(a.min[0] - b.min[0]) > 0.5) return a.min[0] - b.min[0];
        if (Math.abs(a.min[2] - b.min[2]) > 0.5) return a.min[2] - b.min[2];
        return a.min[1] - b.min[1];
      });

      const hasMultiple = g.pieces.length > 1;
      g.pieces.forEach((piece, idx) => {
        piece.id = hasMultiple ? `${g.code}${indexToLetters(idx)}` : g.code;
      });
    });

    return { allPieces: pieces, baseGroups: orderedGroups };
  }, [builtModules]);

  // Nesting / Cutting optimization
  const nestingResults = useMemo(() => {
    return computeNesting(allPieces, config, undefined, nestingSeed);
  }, [allPieces, config, nestingSeed]);

  // Combine groups with nesting placed count & sorted instance codes
  const uniqueGroups: UniqueNomenclatureGroup[] = useMemo(() => {
    return baseGroups.map((g) => {
      const placed = g.pieces.reduce((acc, q) => acc + (q.sheets || []).length, 0);
      const instanceCodes = g.pieces.map((q) => q.id || g.code);
      return {
        code: g.code,
        p: g.p,
        q: g.q,
        names: g.names,
        instanceCodes,
        placed,
      };
    });
  }, [baseGroups, nestingResults]);

  // Hardware summary (Blum + Lamello P-System)
  const hardwareSummary = useMemo(() => {
    const hwMap: Record<string, number> = {};
    builtModules.forEach((m) => {
      m.hw.forEach((item) => {
        const refTag = item.ref ? ` [${item.ref}]` : '';
        const lenTag = item.L ? ` (L=${R(item.L)}mm)` : '';
        const key = `${item.k}${refTag}${lenTag}`;
        hwMap[key] = (hwMap[key] || 0) + item.q;
      });
    });
    return hwMap;
  }, [builtModules]);

  // --- Handlers for Library & Assembly ---
  const handleSaveToLibrary = (overwrite: boolean) => {
    const item: LibraryItem = {
      name: config.name,
      config: JSON.parse(JSON.stringify(config)),
      tree: JSON.parse(JSON.stringify(tree)),
    };

    if (overwrite && editingLibraryIndex !== null && library[editingLibraryIndex]) {
      const updated = [...library];
      updated[editingLibraryIndex] = item;
      setLibrary(updated);
      showToast(`Module « ${config.name} » mis à jour.`);
    } else {
      setLibrary((prev) => [...prev, item]);
      setEditingLibraryIndex(library.length);
      showToast(`Nouveau module « ${config.name} » enregistré.`);
    }
  };

  const handleEditLibraryModule = (index: number) => {
    const item = library[index];
    if (!item) return;
    setConfig(migrateModuleConfig(JSON.parse(JSON.stringify(item.config))));
    setTree(JSON.parse(JSON.stringify(item.tree)));
    setEditingLibraryIndex(index);
    setSelectedPath([]);
    setActiveTab(0);
    showToast(`Module « ${item.name} » chargé dans le studio.`);
  };

  const handleDuplicateLibraryModule = (index: number) => {
    const item = library[index];
    if (!item) return;
    const copy: LibraryItem = {
      name: `${item.name} (Copie)`,
      config: { ...item.config, name: `${item.name} (Copie)` },
      tree: JSON.parse(JSON.stringify(item.tree)),
    };
    setLibrary((prev) => [...prev, copy]);
    showToast('Module dupliqué.');
  };

  const handleDeleteLibraryModule = (index: number) => {
    setLibrary((prev) => prev.filter((_, i) => i !== index));
    setAssembly((prev) =>
      prev
        .filter((a) => a.modId !== index)
        .map((a) => (a.modId > index ? { ...a, modId: a.modId - 1 } : a))
    );
    if (editingLibraryIndex === index) setEditingLibraryIndex(null);
    else if (editingLibraryIndex !== null && editingLibraryIndex > index) {
      setEditingLibraryIndex(editingLibraryIndex - 1);
    }
    showToast('Module supprimé de la bibliothèque.');
  };

  const handleAddModuleToAssembly = (
    modId: number,
    anchorIndex: number,
    face: 'right' | 'left' | 'top',
    rot: 0 | 90 | 180 | 270
  ) => {
    const mod = library[modId];
    if (!mod) return;
    const mt = getPlacementTransform(mod.config, rot, 0, 0);
    let nx = 0;
    let nz = 0;

    const ref = assembly[anchorIndex];
    if (ref) {
      if (face === 'right') {
        nx = ref.x + ref.w;
        nz = ref.z;
      } else if (face === 'left') {
        nx = ref.x - mt.w;
        nz = ref.z;
      } else {
        nx = ref.x;
        nz = ref.z + ref.h;
      }
    } else {
      const last = assembly[assembly.length - 1];
      if (last) {
        nx = last.x + last.w;
        nz = last.z;
      }
    }

    setAssembly((prev) => [
      ...prev,
      {
        modId,
        name: mod.name + (rot ? ` (${rot}°)` : ''),
        x: nx,
        z: nz,
        rot,
        w: mt.w,
        h: mt.h,
      },
    ]);
    showToast(`Module « ${mod.name} » ajouté à l'armoire.`);
  };

  // --- Handlers for 2D Schematic & Cases ---
  const handleApplyDivision = (kind: 'int' | 'mod', cols: number, rows: number) => {
    pushHistory(tree);
    const newTree = JSON.parse(JSON.stringify(tree));
    const target = getNode(newTree, selectedPath);

    if (kind === 'mod') {
      const g = createGrid(cols, rows);
      if (selectedPath.length === 0) {
        setTree(g);
      } else {
        const parent = getNode(newTree, selectedPath.slice(0, -1));
        parent.k![selectedPath[selectedPath.length - 1]] = g;
        setTree(newTree);
      }
    } else {
      const leaf = (): CompartmentNode => ({ t: 'vide', p: 0 });
      const row = (): CompartmentNode =>
        cols > 1 ? { d: 'v', k: Array.from({ length: cols }, leaf) } : leaf();
      const grid: CompartmentNode =
        rows > 1 ? { d: 'h', k: Array.from({ length: rows }, row) } : row();

      target.k = grid.k;
      target.d = grid.d;
      delete target.t;
      setTree(newTree);
    }
    showToast(`Division ${cols} × ${rows} appliquée`);
  };

  const handleUpdateSelectedCell = (updates: any) => {
    pushHistory(tree);
    const newTree = JSON.parse(JSON.stringify(tree));
    const target = getNode(newTree, selectedPath);
    Object.assign(target, updates);
    setTree(newTree);
  };

  const handleFillShelves = (count: number) => {
    pushHistory(tree);
    const newTree = JSON.parse(JSON.stringify(tree));
    const target = getNode(newTree, selectedPath);
    target.k = Array.from({ length: count + 1 }, () => ({ t: 'vide', p: 0 }));
    target.d = 'h';
    delete target.t;
    setTree(newTree);
    showToast(`${count} étagères réparties`);
  };

  const handleFillDrawers = (count: number) => {
    pushHistory(tree);
    const newTree = JSON.parse(JSON.stringify(tree));
    const target = getNode(newTree, selectedPath);
    target.k = Array.from({ length: count }, () => ({ t: 'tiroir', p: 0 }));
    target.d = 'h';
    delete target.t;
    setTree(newTree);
    showToast(`${count} tiroirs Blum empilés`);
  };

  const handleApplyGroupDoors = (doorCount: number, position: any) => {
    if (multiSelectedPaths.length < 2) return;
    pushHistory(tree);
    const newTree = JSON.parse(JSON.stringify(tree));
    multiSelectedPaths.forEach((pStr) => {
      const p = pStr === '' ? [] : pStr.split(',').map(Number);
      const node = getNode(newTree, p);
      node.p = doorCount;
      node.pm = position;
    });
    setTree(newTree);
    setMultiSelectedPaths([]);
    setIsMultiSelect(false);
    showToast(`Portes communes appliquées sur les cases sélectionnées`);
  };

  const handleDeleteSelectedBoard = () => {
    if (!selectedBoard) return;
    pushHistory(tree);
    const newTree = JSON.parse(JSON.stringify(tree));
    const target = getNode(newTree, selectedBoard.path);
    if (!target.k || selectedBoard.index >= target.k.length - 1) return;

    const a = target.k[selectedBoard.index];
    const b = target.k[selectedBoard.index + 1];
    const merged = {
      t: a.t && a.t !== 'vide' ? a.t : b.t || 'vide',
      p: a.p || b.p || 0,
      pm: a.p ? a.pm : b.pm,
      s: (a.s || 0) + (b.s || 0) + config.tInt,
    };
    target.k.splice(selectedBoard.index, 2, merged);

    if (target.k.length === 1) {
      const single = target.k[0];
      target.k = undefined;
      delete target.d;
      target.t = single.t;
      target.p = single.p;
      target.pm = single.pm;
    }

    setSelectedBoard(null);
    setTree(newTree);
    showToast('Planche supprimée et cases réunies');
  };

  const handleResetCaisson = () => {
    pushHistory(tree);
    setTree(mkcs());
    setSelectedPath([]);
    showToast('Caisson réinitialisé');
  };

  // --- Project Save / Open ---
  const saveProjectJson = () => {
    const project: FullProject = {
      app: 'plan-mobilier-pro',
      version: 5,
      date: new Date().toISOString(),
      name: config.name,
      form: config,
      tree,
      library,
      assembly,
      editing: editingLibraryIndex,
    };

    const str = JSON.stringify(project, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projet-mobilier-${config.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Projet enregistré au format JSON.');
  };

  const handleLoadProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result as string);
        if (obj.form) setConfig(migrateModuleConfig(obj.form));
        if (obj.tree) setTree(obj.tree);
        if (obj.library) {
          setLibrary(
            obj.library.map((item: LibraryItem) => ({
              ...item,
              config: migrateModuleConfig(item.config),
            }))
          );
        }
        if (obj.assembly) setAssembly(obj.assembly);
        if (obj.editing !== undefined) setEditingLibraryIndex(obj.editing);
        showToast('Projet chargé avec succès !');
      } catch (err: any) {
        showToast('Fichier invalide : ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const tabs = [
    { id: 0, label: '1. Dimensions & Panneaux' },
    { id: 1, label: '1.1 Séparation' },
    { id: 2, label: '2. Aménagement' },
    { id: 3, label: '3. Armoire' },
    { id: 4, label: '4. Vue 3D' },
    { id: 5, label: '5. Calepinage' },
    { id: 6, label: '6. Fiches & Débit' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-amber-500/20 selection:text-amber-700 dark:selection:text-amber-300 transition-colors">
      {/* Top Workspace Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-300 dark:border-slate-800 shadow-sm noprint">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Brand & Active Target */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow text-slate-950 font-black text-sm shrink-0">
              AM
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  Atelier Mobilier 3D
                </span>
                <span className="hidden md:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  Carlier Bois · Blum · Lamello
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                Module actif : <b className="text-slate-800 dark:text-slate-200">{config.name}</b> ({R(config.W)}×{R(config.H)}×{R(Math.max(config.Dg, config.Dd))} mm)
              </div>
            </div>
          </div>

          {/* Right Utilities: Theme Switcher, History, Open/Save */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Undo/Redo */}
            <div className="hidden sm:flex items-center gap-1 mr-1">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Annuler (Ctrl+Z)"
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Rétablir (Ctrl+Y)"
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sun / Dark Mode Toggle */}
            <button
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              title={
                theme === 'dark'
                  ? 'Passer en Mode Soleil (haute lisibilité)'
                  : 'Passer en Mode Atelier (sombre)'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors shadow-sm ${
                theme === 'light'
                  ? 'bg-amber-100 border-amber-400 text-amber-950 hover:bg-amber-200'
                  : 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Mode Soleil</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-800" />
                  <span className="hidden sm:inline">Mode Atelier</span>
                </>
              )}
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-300 text-xs font-medium rounded-lg cursor-pointer transition-colors shadow-sm">
              <FolderOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">Ouvrir</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleLoadProjectFile}
                className="hidden"
              />
            </label>

            <button
              onClick={saveProjectJson}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enregistrer</span>
            </button>
          </div>
        </div>

        {/* Unified Step Navigation & View Source Bar */}
        <div className="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-200/80 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hidden lg:inline">
                Source 3D/Débit :
              </span>
              <select
                value={viewSource}
                onChange={(e) => setViewSource(e.target.value as 'auto' | 'arm' | 'mod')}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs px-2.5 py-1 rounded-md font-medium"
              >
                <option value="auto">
                  Auto ({assembly.length > 0 ? `Armoire (${assembly.length})` : 'Module actif'})
                </option>
                <option value="arm">Armoire assemblée ({assembly.length} modules)</option>
                <option value="mod">Module actif seul</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {activeTab === 0 && (
          <ModuleConfigurator
            config={config}
            tree={tree}
            piecesCount={currentBuiltModule.P.length}
            totalAreaM2={currentModuleAreaM2}
            onChange={(updated) => setConfig(syncDerivedConfig(updated))}
            onSaveToLibrary={handleSaveToLibrary}
            canOverwrite={editingLibraryIndex !== null}
            onOpenSchematic={() => setActiveTab(2)}
            onOpen3D={() => setActiveTab(4)}
          />
        )}

        {activeTab === 1 && (
          <AutoSplitter
            config={config}
            tree={tree}
            onApplySplit={(path, newGrid) => {
              pushHistory(tree);
              if (path.length === 0) setTree(newGrid);
              else {
                const newTree = JSON.parse(JSON.stringify(tree));
                const par = getNode(newTree, path.slice(0, -1));
                par.k![path[path.length - 1]] = newGrid;
                setTree(newTree);
              }
              showToast('Séparation en caissons appliquée.');
            }}
            onOpenAménagement={() => setActiveTab(2)}
          />
        )}

        {activeTab === 2 && (
          <SchematicEditor
            config={config}
            tree={tree}
            selectedPath={selectedPath}
            multiSelectedPaths={multiSelectedPaths}
            isMultiSelect={isMultiSelect}
            selectedBoard={selectedBoard}
            onSelectPath={(p) => {
              if (isMultiSelect) {
                const pStr = p.join(',');
                setMultiSelectedPaths((prev) =>
                  prev.includes(pStr) ? prev.filter((x) => x !== pStr) : [...prev, pStr]
                );
              } else {
                setSelectedPath(p);
              }
            }}
            onToggleMultiSelect={() => {
              setIsMultiSelect(!isMultiSelect);
              setSelectedBoard(null);
            }}
            onSelectAllCells={() => {
              setIsMultiSelect(true);
              const all: string[] = [];
              (function f(n: CompartmentNode) {
                if (!n.k && !n.m) all.push((n.pt || []).join(','));
                else if (n.k) n.k.forEach(f);
              })(tree);
              setMultiSelectedPaths(all);
            }}
            onClearSelection={() => {
              setMultiSelectedPaths([]);
              setSelectedBoard(null);
            }}
            onSelectBoard={setSelectedBoard}
            onApplyDivision={handleApplyDivision}
            onUpdateSelectedCell={handleUpdateSelectedCell}
            onFillShelves={handleFillShelves}
            onFillDrawers={handleFillDrawers}
            onApplyGroupDoors={handleApplyGroupDoors}
            onDeleteSelectedBoard={handleDeleteSelectedBoard}
            onResetCaisson={handleResetCaisson}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        )}

        {activeTab === 3 && (
          <AssemblyManager
            library={library}
            assembly={assembly}
            onAddModule={handleAddModuleToAssembly}
            onRemoveAssemblyModule={(idx) =>
              setAssembly((prev) => prev.filter((_, i) => i !== idx))
            }
            onClearAssembly={() => setAssembly([])}
            onEditLibraryModule={handleEditLibraryModule}
            onDuplicateLibraryModule={handleDuplicateLibraryModule}
            onDeleteLibraryModule={handleDeleteLibraryModule}
          />
        )}

        {activeTab === 4 && (
          <ThreeViewer
            modules={builtModules}
            activeSourceLabel={
              shouldUseAssembly
                ? `Armoire (${builtModules.length} module${builtModules.length > 1 ? 's' : ''})`
                : `Module actif : ${config.name}`
            }
            isLightMode={theme === 'light'}
          />
        )}

        {activeTab === 5 && (
          <NestingViewer
            nestingResults={nestingResults}
            config={config}
            onReoptimize={() => {
              setNestingSeed((prev) => prev + 1);
              showToast('Nouvelle recherche de calepinage lancée');
            }}
            onOpenSplitter={() => setActiveTab(1)}
          />
        )}

        {activeTab === 6 && (
          <div className="flex flex-col gap-8">
            <NomenclatureTable
              modules={builtModules}
              allPieces={allPieces}
              uniqueGroups={uniqueGroups}
              hardwareSummary={hardwareSummary}
              onPrint={() => window.print()}
            />
            <MachiningCards uniqueGroups={uniqueGroups} allPieces={allPieces} />
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-lg font-semibold text-xs shadow-2xl flex items-center gap-2 border border-amber-300 noprint">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

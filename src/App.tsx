import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Camera,
  Compass,
  Download,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  Layout,
  LayoutGrid,
  ListOrdered,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Scissors,
  Sliders,
  Sparkles,
  Wrench,
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

export default function App() {
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
      if ((e.ctrlKey || e.metaKey) && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName || '')) {
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

  // Build current module result
  const currentBuiltModule = useMemo(() => {
    return buildModule(config, tree);
  }, [config, tree]);

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

  // All pieces in current view
  const allPieces: PartPiece[] = useMemo(() => {
    return builtModules.flatMap((m) => m.P);
  }, [builtModules]);

  // Group identical pieces and assign unique codes (A-1, A-2, etc.)
  const uniqueGroups = useMemo(() => {
    const map: Record<string, { code: string; p: PartPiece; q: number; names: string[]; placed: number }> = {};
    const countByLetter: Record<string, number> = {};
    const groups: { code: string; p: PartPiece; q: number; names: string[]; placed: number }[] = [];

    allPieces.forEach((p) => {
      const letter = p.letter || 'A';
      const sig = [
        letter,
        R(p.L),
        R(p.l),
        R1(p.bt),
        p.mat,
        p.sheetL,
        p.sheetW,
        p.cut,
        p.pl ? JSON.stringify(p.pl.map((a) => a.map(R))) : '',
        JSON.stringify(
          p.h.map((h) => [h.k, h.e, R(h.u || 0), R(h.v || 0), R(h.pos || 0), h.d || 0, h.depth || 0])
        ),
        p.mult,
      ].join('|');

      if (!map[sig]) {
        countByLetter[letter] = (countByLetter[letter] || 0) + 1;
        const code = `${letter}-${countByLetter[letter]}`;
        map[sig] = { code, p, q: 0, names: [], placed: 0 };
        groups.push(map[sig]);
      }

      const g = map[sig];
      g.q += p.mult || 1;
      if (!g.names.includes(p.name)) g.names.push(p.name);
      p.code = g.code;
    });

    return groups;
  }, [allPieces]);

  // Nesting / Cutting optimization
  const nestingResults = useMemo(() => {
    return computeNesting(allPieces, config, undefined, nestingSeed);
  }, [allPieces, config, nestingSeed]);

  // Update placed count on each group based on nesting sheets
  useEffect(() => {
    uniqueGroups.forEach((g) => {
      g.placed = allPieces
        .filter((q) => q.code === g.code)
        .reduce((acc, q) => acc + (q.sheets || []).length, 0);
    });
  }, [uniqueGroups, nestingResults, allPieces]);

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500/20 selection:text-amber-300">
      {/* Top Bar Contract (3 Zones: Brand Title, Nav Links, Primary CTA) */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        {/* Zone 1: Single element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg text-slate-950 font-black text-sm">
            AM
          </div>
          <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
            Atelier Mobilier 3D
          </span>
          <span className="hidden sm:inline-block text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
            Carlier Bois · Blum · Lamello P-System
          </span>
        </div>

        {/* Zone 2: Navigation Links (Clean single line with hover) */}
        <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab(0)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 0 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            1. Dimensions
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 1 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            1.1 Séparation
          </button>
          <button
            onClick={() => setActiveTab(2)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 2 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            2. Aménagement
          </button>
          <button
            onClick={() => setActiveTab(3)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 3 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            3. Armoire & Modules
          </button>
          <button
            onClick={() => setActiveTab(4)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 4 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            4. Vue 3D
          </button>
          <button
            onClick={() => setActiveTab(5)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 5 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            5. Calepinage
          </button>
          <button
            onClick={() => setActiveTab(6)}
            className={`transition-colors whitespace-nowrap hover:text-slate-100 ${
              activeTab === 6 ? 'text-amber-400 font-bold' : ''
            }`}
          >
            6. Nomenclature & Débit
          </button>
        </nav>

        {/* Zone 3: Project Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg cursor-pointer transition-colors shadow-sm">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Ouvrir</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleLoadProjectFile}
              className="hidden"
            />
          </label>

          <button
            onClick={saveProjectJson}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-md transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer</span>
          </button>
        </div>
      </header>

      {/* Secondary Mobile Tabs & Workspace Filter Bar */}
      <div className="flex items-center justify-between px-6 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs overflow-x-auto gap-3">
        {/* Tab Buttons Strip */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 0, label: '1. Dimensions' },
            { id: 1, label: '1.1 Séparation' },
            { id: 2, label: '2. Aménagement' },
            { id: 3, label: '3. Armoire' },
            { id: 4, label: '4. Vue 3D' },
            { id: 5, label: '5. Calepinage' },
            { id: 6, label: '6. Fiches & Débit' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Source Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 hidden md:inline">Affichage :</span>
          <select
            value={viewSource}
            onChange={(e) => setViewSource(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded"
          >
            <option value="auto">
              Auto ({assembly.length > 0 ? 'Armoire complète' : 'Module actif'})
            </option>
            <option value="arm">Armoire assemblée ({assembly.length} modules)</option>
            <option value="mod">Module en cours de conception seul</option>
          </select>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {activeTab === 0 && (
          <ModuleConfigurator
            config={config}
            onChange={(updated) => setConfig(syncDerivedConfig(updated))}
            onSaveToLibrary={handleSaveToLibrary}
            canOverwrite={editingLibraryIndex !== null}
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
              (function f(n) {
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-lg font-semibold text-xs shadow-2xl flex items-center gap-2 border border-amber-300">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

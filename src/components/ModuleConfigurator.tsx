import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Box,
  CheckCircle2,
  CopyCheck,
  LayoutGrid,
  Layers,
  Lock,
  Package,
  Ruler,
  Sliders,
  Unlock,
  Wrench,
} from 'lucide-react';
import {
  BackType,
  BlumHingeId,
  BlumRunnerId,
  CompartmentNode,
  JointType,
  LamelloConnectorId,
  MaterialCategory,
  ModuleConfig,
  PanelRole,
  PanelRoleConfig,
} from '../types/furniture';
import { CARLIER_PANELS_CATALOG, getPanelById } from '../data/carlier-panels';
import {
  BLUM_CATALOG,
  BLUM_HINGES,
  BLUM_RUNNERS,
  computeAutoClearances,
} from '../data/blum-hardware';
import { LAMELLO_SYSTEMS, validateLamelloConfig } from '../data/lamello-psystem';
import { PANEL_ROLES_META, syncDerivedConfig } from '../data/presets';
import { R } from '../utils/woodworking-math';

interface ModuleConfiguratorProps {
  config: ModuleConfig;
  tree: CompartmentNode;
  piecesCount: number;
  totalAreaM2: number;
  onChange: (updated: ModuleConfig) => void;
  onSaveToLibrary: (overwrite: boolean) => void;
  canOverwrite: boolean;
  onOpenSchematic: () => void;
  onOpen3D: () => void;
}

type ConfigSubTab = 'dims' | 'panels' | 'lamello' | 'blum';

const ALL_CATEGORIES: ('Toutes' | MaterialCategory)[] = [
  'Toutes',
  'Mélaminés Décors Bois',
  'Mélaminés Unis & Matières',
  'Stratifiés HPL',
  'Placages Bois Nobles',
  'MDF & Fibres (HDF)',
  'Agglomérés (Particules)',
  'Contreplaqués & Multiplex',
  '3 Plis & Bois Massif',
  'Lattés (Blockboard)',
  'Compact HPL & OSB',
];

export const ModuleConfigurator: React.FC<ModuleConfiguratorProps> = ({
  config,
  tree,
  piecesCount,
  totalAreaM2,
  onChange,
  onSaveToLibrary,
  canOverwrite,
  onOpenSchematic,
  onOpen3D,
}) => {
  const [subTab, setSubTab] = useState<ConfigSubTab>('dims');
  const [activeRole, setActiveRole] = useState<PanelRole>('corps');
  const [categoryFilter, setCategoryFilter] = useState<'Toutes' | MaterialCategory>('Toutes');

  const isAsymmetric = !config.sym;

  const applyConfigUpdate = (partial: Partial<ModuleConfig>) => {
    onChange(syncDerivedConfig({ ...config, ...partial }));
  };

  const updateRole = (role: PanelRole, patch: Partial<PanelRoleConfig>) => {
    const updatedRoles = {
      ...config.roles,
      [role]: {
        ...config.roles[role],
        ...patch,
      },
    };
    applyConfigUpdate({ roles: updatedRoles });
  };

  const handleSelectPanelForRole = (role: PanelRole, panelId: string) => {
    const panel = getPanelById(panelId);
    const current = config.roles[role];
    const defaultFmt = panel.availableFormats[0] || { length: 2800, width: 2070 };

    let thickness = current.thickness;
    if (role === 'fond') {
      thickness = panel.standardThicknesses.includes(4)
        ? 4
        : panel.standardThicknesses.includes(8)
        ? 8
        : panel.standardThicknesses[0];
    } else if (role === 'tiroirs') {
      thickness = panel.standardThicknesses.includes(15)
        ? 15
        : panel.standardThicknesses.includes(16)
        ? 16
        : panel.standardThicknesses[0];
    } else if (!panel.standardThicknesses.includes(thickness)) {
      thickness = panel.standardThicknesses.includes(19)
        ? 19
        : panel.standardThicknesses.includes(18)
        ? 18
        : panel.standardThicknesses[0];
    }

    updateRole(role, {
      panelId: panel.id,
      thickness,
      sheetL: defaultFmt.length,
      sheetW: defaultFmt.width,
      allowRot: !panel.grain,
    });
  };

  const activeRoleConf = config.roles[activeRole];
  const activePanel = getPanelById(activeRoleConf.panelId);

  const filteredPanels = useMemo(() => {
    if (categoryFilter === 'Toutes') return CARLIER_PANELS_CATALOG;
    return CARLIER_PANELS_CATALOG.filter((p) => p.category === categoryFilter);
  }, [categoryFilter]);

  const lamelloChecks = useMemo(() => validateLamelloConfig(config), [config]);
  const hasLamelloError = lamelloChecks.some((c) => c.level === 'error');
  const hasLamelloWarn = lamelloChecks.some((c) => c.level === 'warning');

  const selectedHinge = BLUM_HINGES[config.hingeId] || BLUM_HINGES['71B3550'];
  const selectedRunner = BLUM_RUNNERS[config.runnerId] || BLUM_RUNNERS.MOVENTO_BLUMOTION;
  const autoClearancePreview = useMemo(
    () => computeAutoClearances(config.hingeId, config.runnerId, config.tP, config.tTr),
    [config.hingeId, config.runnerId, config.tP, config.tTr]
  );

  // Live miniature SVG preview helper
  const renderMiniElevation = () => {
    const W = Math.max(config.W, 100);
    const H = Math.max(config.H, config.Hd || config.H, 100);
    const cells: React.ReactNode[] = [];
    const walk = (n: CompartmentNode, idxPath: string) => {
      if (n.r && !n.m) {
        const y = H - n.r.z - n.r.h;
        cells.push(
          <rect
            key={idxPath}
            x={n.r.x}
            y={y}
            width={Math.max(1, n.r.w)}
            height={Math.max(1, n.r.h)}
            className={
              n.cs
                ? 'fill-slate-100 dark:fill-slate-900 stroke-amber-600 dark:stroke-amber-500 stroke-[6px]'
                : n.t === 'tiroir'
                ? 'fill-amber-500/15 stroke-amber-600 dark:stroke-amber-400 stroke-[3px]'
                : 'fill-white/60 dark:fill-slate-800/60 stroke-slate-400 dark:stroke-slate-600 stroke-[2px]'
            }
          />
        );
        if (n.t === 'tringle') {
          cells.push(
            <line
              key={`${idxPath}-rod`}
              x1={n.r.x + 15}
              y1={y + 60}
              x2={n.r.x + n.r.w - 15}
              y2={y + 60}
              className="stroke-amber-600 dark:stroke-amber-400 stroke-[8px]"
            />
          );
        }
      }
      if (n.k) n.k.forEach((c, i) => walk(c, `${idxPath}-${i}`));
    };
    walk(tree, '0');

    return (
      <svg
        viewBox={`-40 -40 ${W + 80} ${H + 80}`}
        className="w-full h-44 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2"
      >
        {cells}
        {Math.abs(config.H - (config.Hd || config.H)) > 0.5 && (
          <line
            x1={0}
            y1={config.obH !== 'bas' ? H - config.H : config.H}
            x2={W}
            y2={config.obH !== 'bas' ? H - config.Hd : config.Hd}
            className="stroke-rose-600 dark:stroke-amber-400 stroke-[8px] stroke-dasharray-[18_10]"
          />
        )}
      </svg>
    );
  };

  const cardCls =
    'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-5 shadow-md dark:shadow-xl';
  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 rounded-lg focus:border-amber-500 focus:outline-none';
  const subCardCls =
    'bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800 rounded-lg p-3.5';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Structured 4-Section Ergonomic Configurator */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {/* Sub-navigation bar inside Step 1 for zero endless scrolling */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
          <button
            onClick={() => setSubTab('dims')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              subTab === 'dims'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Dimensions</span>
          </button>

          <button
            onClick={() => setSubTab('panels')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              subTab === 'panels'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Panneaux Carlier</span>
          </button>

          <button
            onClick={() => setSubTab('lamello')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              subTab === 'lamello'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Lamello P-System</span>
            {hasLamelloError && <span className="w-2 h-2 rounded-full bg-rose-500" />}
            {!hasLamelloError && hasLamelloWarn && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          <button
            onClick={() => setSubTab('blum')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              subTab === 'blum'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Quincaillerie Blum</span>
          </button>
        </div>

        {/* SUBTAB 1: DIMENSIONS & GEOMETRIE */}
        {subTab === 'dims' && (
          <section className={`${cardCls} flex flex-col gap-4`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  1. Dimensions, Forme & Socle du Caisson
                </h3>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-semibold">
                {config.W} × {config.H} × {config.Dg} mm
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Nom du module
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => applyConfigUpdate({ name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Largeur hors-tout W (mm)
                </label>
                <input
                  type="number"
                  value={config.W}
                  onChange={(e) => applyConfigUpdate({ W: Number(e.target.value) })}
                  className={`${inputCls} font-mono`}
                />
                <div className="flex gap-1 mt-1.5">
                  {[600, 800, 900, 1000, 1200].map((wVal) => (
                    <button
                      key={wVal}
                      type="button"
                      onClick={() => applyConfigUpdate({ W: wVal })}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                        config.W === wVal
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {wVal}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Géométrie du volume
                </label>
                <select
                  value={config.sym ? 'S' : 'A'}
                  onChange={(e) => {
                    const isSym = e.target.value === 'S';
                    applyConfigUpdate({
                      sym: isSym,
                      Hd: isSym ? config.H : config.Hd,
                      Dd: isSym ? config.Dg : config.Dd,
                    });
                  }}
                  className={inputCls}
                >
                  <option value="S">Symétrique (Équerre standard)</option>
                  <option value="A">Asymétrique (Sous-pente / Trapèze)</option>
                </select>
              </div>
            </div>

            {/* Sides Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-sky-50/70 dark:bg-slate-950/70 border border-sky-300 dark:border-sky-500/30 rounded-lg p-3.5 flex flex-col gap-3">
                <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
                  ◀ Côté gauche (vu de face)
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-700 dark:text-slate-400 block mb-1">
                      Hauteur Hg (mm)
                    </label>
                    <input
                      type="number"
                      value={config.H}
                      onChange={(e) => {
                        const h = Number(e.target.value);
                        applyConfigUpdate({ H: h, ...(config.sym ? { Hd: h } : {}) });
                      }}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-400 block mb-1">
                      Profondeur Dg (mm)
                    </label>
                    <input
                      type="number"
                      value={config.Dg}
                      onChange={(e) => {
                        const d = Number(e.target.value);
                        applyConfigUpdate({ Dg: d, ...(config.sym ? { Dd: d } : {}) });
                      }}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.fL}
                    onChange={(e) => applyConfigUpdate({ fL: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>Fileur d'ajustement gauche (+{config.fW} mm)</span>
                </label>
              </div>

              <div
                className={`border rounded-lg p-3.5 flex flex-col gap-3 transition-opacity ${
                  isAsymmetric
                    ? 'bg-emerald-50/70 dark:bg-slate-950/70 border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 opacity-70'
                }`}
              >
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Côté droit ▶ {config.sym ? '(= identique gauche)' : '(Sous-pente)'}
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-700 dark:text-slate-400 block mb-1">
                      Hauteur Hd (mm)
                    </label>
                    <input
                      type="number"
                      disabled={config.sym}
                      value={config.Hd}
                      onChange={(e) => applyConfigUpdate({ Hd: Number(e.target.value) })}
                      className={`${inputCls} font-mono disabled:opacity-45`}
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-400 block mb-1">
                      Profondeur Dd (mm)
                    </label>
                    <input
                      type="number"
                      disabled={config.sym}
                      value={config.Dd}
                      onChange={(e) => applyConfigUpdate({ Dd: Number(e.target.value) })}
                      className={`${inputCls} font-mono disabled:opacity-45`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.fR}
                    onChange={(e) => applyConfigUpdate({ fR: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>Fileur d'ajustement droit (+{config.fW} mm)</span>
                </label>
              </div>
            </div>

            {/* Plinth & Fillers */}
            <div className={`${subCardCls} grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-center`}>
              <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={config.hasPlinth}
                  onChange={(e) => applyConfigUpdate({ hasPlinth: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Plinthe socle</span>
              </label>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">
                  Hauteur plinthe (mm)
                </label>
                <input
                  type="number"
                  disabled={!config.hasPlinth}
                  value={config.plinthHeight}
                  onChange={(e) => applyConfigUpdate({ plinthHeight: Number(e.target.value) })}
                  className={`${inputCls} font-mono py-1.5 disabled:opacity-45`}
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">
                  Retrait plinthe (mm)
                </label>
                <input
                  type="number"
                  disabled={!config.hasPlinth}
                  value={config.plinthSetback}
                  onChange={(e) => applyConfigUpdate({ plinthSetback: Number(e.target.value) })}
                  className={`${inputCls} font-mono py-1.5 disabled:opacity-45`}
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">
                  Largeur fileurs (mm)
                </label>
                <input
                  type="number"
                  value={config.fW}
                  onChange={(e) => applyConfigUpdate({ fW: Number(e.target.value) })}
                  className={`${inputCls} font-mono py-1.5`}
                />
              </div>
            </div>

            {isAsymmetric && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-800 dark:text-slate-300 font-medium block mb-1">
                    Plan oblique de toiture
                  </label>
                  <select
                    value={config.obH}
                    onChange={(e) => applyConfigUpdate({ obH: e.target.value as any })}
                    className={inputCls}
                  >
                    <option value="haut">Dessus oblique (Sous-pente)</option>
                    <option value="bas">Dessous oblique (Sous-escalier)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-800 dark:text-slate-300 font-medium block mb-1">
                    Face oblique profondeur
                  </label>
                  <select
                    value={config.obq}
                    onChange={(e) => applyConfigUpdate({ obq: e.target.value as any })}
                    className={inputCls}
                  >
                    <option value="fond">Fond oblique, façade droite</option>
                    <option value="avant">Façade oblique, fond droit</option>
                  </select>
                </div>
                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 text-slate-800 dark:text-slate-300 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={config.trap}
                      onChange={(e) => applyConfigUpdate({ trap: e.target.checked })}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>Horizontaux en trapèze</span>
                  </label>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SUBTAB 2: PANNEAUX CARLIER BOIS PAR RÔLE */}
        {subTab === 'panels' && (
          <section className={`${cardCls} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  2. Panneaux Carlier Bois — Sélection Indépendante par Rôle
                </h3>
              </div>
              <button
                onClick={() =>
                  applyConfigUpdate({
                    roles: {
                      ...config.roles,
                      interieur: { ...config.roles.corps, doubled: false },
                    },
                  })
                }
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded transition-colors"
              >
                <CopyCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Copier Corps → Intérieur</span>
              </button>
            </div>

            {/* 5 Role Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
              {PANEL_ROLES_META.map((meta) => {
                const rConf = config.roles[meta.role];
                const pnl = getPanelById(rConf.panelId);
                const isActive = activeRole === meta.role;
                const effThickness = rConf.doubled ? rConf.thickness * 2 : rConf.thickness;

                return (
                  <button
                    key={meta.role}
                    onClick={() => setActiveRole(meta.role)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-500 shadow'
                        : 'bg-slate-50 dark:bg-slate-950/70 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`text-xs font-bold ${
                          isActive
                            ? 'text-amber-800 dark:text-amber-400'
                            : 'text-slate-900 dark:text-slate-200'
                        }`}
                      >
                        {meta.label}
                      </span>
                      <div
                        className="w-4 h-4 rounded border border-slate-400 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: pnl.colorHex }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate w-full">
                      {pnl.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                      {effThickness} mm{rConf.doubled ? ' ×2' : ''} · {rConf.sheetL}×{rConf.sheetW}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Role Detailed Editor */}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded border border-slate-400 dark:border-slate-600 shadow"
                    style={{ backgroundColor: activePanel.colorHex }}
                  />
                  <div>
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {PANEL_ROLES_META.find((m) => m.role === activeRole)?.label} —{' '}
                      {activePanel.name}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {activePanel.brand} · {activePanel.code} · ~{activePanel.pricePerM2.toFixed(2)}{' '}
                      €/m² HTVA · {activePanel.densityKgM3} kg/m³
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  {activePanel.grain ? 'Sens du fil marqué' : 'Sans sens du fil'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                <div className="md:col-span-4">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold block mb-1">
                    Famille Carlier
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className={inputCls}
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'Toutes' ? 'Toutes les familles (26 réf.)' : cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-8">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold block mb-1">
                    Référence panneau Carlier Bois ({filteredPanels.length} disponibles)
                  </label>
                  <select
                    value={
                      filteredPanels.some((p) => p.id === activeRoleConf.panelId)
                        ? activeRoleConf.panelId
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) handleSelectPanelForRole(activeRole, e.target.value);
                    }}
                    className={inputCls}
                  >
                    {!filteredPanels.some((p) => p.id === activeRoleConf.panelId) && (
                      <option value="">
                        Actuel : {activePanel.name} ({activePanel.category})
                      </option>
                    )}
                    {filteredPanels.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name} — {p.brand} ({p.standardThicknesses.join('/')}mm)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
                <div className="md:col-span-4">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold block mb-1">
                    Format commercial usine
                  </label>
                  <select
                    value={
                      activePanel.availableFormats.find(
                        (f) =>
                          f.length === activeRoleConf.sheetL && f.width === activeRoleConf.sheetW
                      )
                        ? `${activeRoleConf.sheetL}x${activeRoleConf.sheetW}`
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value === 'custom') return;
                      const [L, W] = e.target.value.split('x').map(Number);
                      updateRole(activeRole, { sheetL: L, sheetW: W });
                    }}
                    className={inputCls}
                  >
                    {activePanel.availableFormats.map((fmt) => (
                      <option key={fmt.label} value={`${fmt.length}x${fmt.width}`}>
                        {fmt.label}
                      </option>
                    ))}
                    <option value="custom">
                      Format libre ({activeRoleConf.sheetL} × {activeRoleConf.sheetW} mm)
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold block mb-1">
                    Long. brut SL
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={6000}
                    value={activeRoleConf.sheetL}
                    onChange={(e) => updateRole(activeRole, { sheetL: Number(e.target.value) })}
                    className={`${inputCls} font-mono`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold block mb-1">
                    Larg. brut SW
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={3000}
                    value={activeRoleConf.sheetW}
                    onChange={(e) => updateRole(activeRole, { sheetW: Number(e.target.value) })}
                    className={`${inputCls} font-mono`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-700 dark:text-slate-400 font-semibold block mb-1">
                    Épaisseur (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={2}
                    max={60}
                    value={activeRoleConf.thickness}
                    onChange={(e) => updateRole(activeRole, { thickness: Number(e.target.value) })}
                    className={`${inputCls} font-mono`}
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5 text-slate-800 dark:text-slate-200">
                  {(activeRole === 'corps' || activeRole === 'facades') && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeRoleConf.doubled}
                        onChange={(e) => updateRole(activeRole, { doubled: e.target.checked })}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                      <span>Doublé (×2)</span>
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeRoleConf.allowRot}
                      onChange={(e) => updateRole(activeRole, { allowRot: e.target.checked })}
                      className="w-3.5 h-3.5 accent-amber-500"
                    />
                    <span>Rotation 90°</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-600 dark:text-slate-400 mr-1 font-medium">
                  Épaisseurs stock Carlier :
                </span>
                {activePanel.standardThicknesses.map((th) => (
                  <button
                    key={th}
                    onClick={() => updateRole(activeRole, { thickness: th })}
                    className={`px-2 py-0.5 rounded font-mono border transition-colors ${
                      activeRoleConf.thickness === th
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-500'
                    }`}
                  >
                    {th} mm
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SUBTAB 3: LAMELLO P-SYSTEM */}
        {subTab === 'lamello' && (
          <section className={`${cardCls} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  3. Configurateur d'Assemblage Lamello P-System & Usinages
                </h3>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                Zeta P2 / CNC · Prof. {LAMELLO_SYSTEMS[config.fx].grooveDepthMm} mm
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Fixation du corps (Extérieur)
                </label>
                <select
                  value={config.fx}
                  onChange={(e) => applyConfigUpdate({ fx: e.target.value as LamelloConnectorId })}
                  className={inputCls}
                >
                  {Object.values(LAMELLO_SYSTEMS).map((sys) => (
                    <option key={sys.id} value={sys.id}>
                      {sys.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Fixation cloisons & tablettes
                </label>
                <select
                  value={config.fxInt}
                  onChange={(e) => applyConfigUpdate({ fxInt: e.target.value as any })}
                  className={inputCls}
                >
                  <option value="clamex_medius">
                    Lamello Clamex P-14/10 Medius (Cloison ≥16mm)
                  </option>
                  <option value="divario_p18">
                    Lamello Divario P-18 (Coulissant invisible ≥18mm)
                  </option>
                  <option value="clamex_p14">Lamello Clamex P-14 (Standard)</option>
                  <option value="clamex_p10">Lamello Clamex P-10 (Mince ≥12mm)</option>
                  <option value="tenso_p14">Lamello Tenso P-14 (Collé invisible)</option>
                  <option value="tenso_p10">Lamello Tenso P-10 (Collé mince)</option>
                  <option value="taquets_5mm">Taquets métalliques Ø5 mm</option>
                  <option value="confirmat_7x50">Vis Confirmat 7×50 mm</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Géométrie des angles caisson
                </label>
                <select
                  value={config.j}
                  onChange={(e) => applyConfigUpdate({ j: e.target.value as JointType })}
                  className={inputCls}
                >
                  <option value="A">90° — Dessus/dessous couvrent les côtés</option>
                  <option value="B">90° — Côtés couvrent dessus/dessous</option>
                  <option value="C">45° — Coupe d'onglet (P-System)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Montage du fond ({config.tb} mm)
                </label>
                <select
                  value={config.b}
                  onChange={(e) => applyConfigUpdate({ b: e.target.value as BackType })}
                  className={inputCls}
                >
                  <option value="A">Appliqué en feuillure arrière</option>
                  <option value="R">Encastré en rainure arrière</option>
                  <option value="N">Sans fond (meuble traversant)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {lamelloChecks.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                    msg.level === 'error'
                      ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                      : msg.level === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  {msg.level === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  ) : msg.level === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">{msg.title}</span>
                    <span className="text-[11px] opacity-90">{msg.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`${subCardCls} grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-center`}>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">
                  Marge extrémité (mm)
                </label>
                <input
                  type="number"
                  value={config.mg}
                  onChange={(e) => applyConfigUpdate({ mg: Number(e.target.value) })}
                  className={`${inputCls} font-mono py-1.5`}
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">
                  Entraxe max (mm)
                </label>
                <input
                  type="number"
                  value={config.es}
                  onChange={(e) => applyConfigUpdate({ es: Number(e.target.value) })}
                  className={`${inputCls} font-mono py-1.5`}
                />
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Outillage requis :
                </span>
                <span>{LAMELLO_SYSTEMS[config.fx].cutterSpec}</span>
              </div>
            </div>
          </section>
        )}

        {/* SUBTAB 4: QUINCAILLERIE BLUM */}
        {subTab === 'blum' && (
          <section className={`${cardCls} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  4. Catalogue Quincaillerie Blum & Adaptation des Jeux
                </h3>
              </div>

              <button
                onClick={() => applyConfigUpdate({ autoClearances: !config.autoClearances })}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  config.autoClearances
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300'
                }`}
              >
                {config.autoClearances ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
                <span>
                  Jeux auto Blum : {config.autoClearances ? 'Activés' : 'Mode manuel'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className={`${subCardCls} flex flex-col gap-2`}>
                <label className="text-slate-800 dark:text-slate-200 font-bold">
                  Charnières Blum CLIP top
                </label>
                <select
                  value={config.hingeId}
                  onChange={(e) => applyConfigUpdate({ hingeId: e.target.value as BlumHingeId })}
                  className={inputCls}
                >
                  {BLUM_CATALOG.hinges.map((h) => (
                    <option key={h.id} value={h.id}>
                      [{h.ref}] {h.name}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Angle {selectedHinge.openingAngle}° · Finition {selectedHinge.finish} · Ép. max{' '}
                  {selectedHinge.maxDoorThicknessMm} mm · {selectedHinge.notes}
                </div>
              </div>

              <div className={`${subCardCls} flex flex-col gap-2`}>
                <label className="text-slate-800 dark:text-slate-200 font-bold">
                  Coulisses & Systèmes Box Blum
                </label>
                <select
                  value={config.runnerId}
                  onChange={(e) => applyConfigUpdate({ runnerId: e.target.value as BlumRunnerId })}
                  className={inputCls}
                >
                  {BLUM_CATALOG.runners.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.refBase}] {r.name}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Charge {selectedRunner.loadCapacityKg} kg · {selectedRunner.motionTechnology} ·{' '}
                  {selectedRunner.notes}
                </div>
              </div>
            </div>

            <div className={`${subCardCls} flex flex-col gap-3`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Jeu lat. tiroir jlat (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.autoClearances}
                    value={config.jlat}
                    onChange={(e) => applyConfigUpdate({ jlat: Number(e.target.value) })}
                    className={`${inputCls} font-mono font-bold text-amber-800 dark:text-amber-300 disabled:opacity-80`}
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Jeu vert. tiroir jvd (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.autoClearances}
                    value={config.jvd}
                    onChange={(e) => applyConfigUpdate({ jvd: Number(e.target.value) })}
                    className={`${inputCls} font-mono font-bold text-amber-800 dark:text-amber-300 disabled:opacity-80`}
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Jeu façade jg (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.autoClearances}
                    value={config.jg}
                    onChange={(e) => applyConfigUpdate({ jg: Number(e.target.value) })}
                    className={`${inputCls} font-mono font-bold text-amber-800 dark:text-amber-300 disabled:opacity-80`}
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Axe Ø35 au chant (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.autoClearances}
                    value={config.hingeCupOffset}
                    onChange={(e) =>
                      applyConfigUpdate({ hingeCupOffset: Number(e.target.value) })
                    }
                    className={`${inputCls} font-mono font-bold text-amber-800 dark:text-amber-300 disabled:opacity-80`}
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-col gap-0.5">
                {autoClearancePreview.notes.map((n, idx) => (
                  <span key={idx}>{n}</span>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* RIGHT COLUMN: Sticky Live Aperçu & Fiche Synthèse */}
      <aside className="lg:col-span-4 lg:sticky lg:top-20 flex flex-col gap-4">
        <div className={`${cardCls} flex flex-col gap-3.5`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Aperçu du Module
            </span>
            <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
              {R(config.W)} × {R(config.H)} × {R(config.Dg)}
            </span>
          </div>

          {renderMiniElevation()}

          {/* Quick Jump Buttons */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={onOpenSchematic}
              className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Aménager →</span>
            </button>
            <button
              onClick={onOpen3D}
              className="flex items-center justify-center gap-1.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold rounded-lg transition-colors"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Voir en 3D →</span>
            </button>
          </div>

          {/* Selected Panels Summary */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Panneaux Carlier actifs
            </span>
            {PANEL_ROLES_META.map((m) => {
              const rc = config.roles[m.role];
              const p = getPanelById(rc.panelId);
              return (
                <button
                  key={m.role}
                  onClick={() => {
                    setSubTab('panels');
                    setActiveRole(m.role);
                  }}
                  className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm border border-slate-400 dark:border-slate-600 shrink-0"
                      style={{ backgroundColor: p.colorHex }}
                    />
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">{m.label}:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-200 truncate">
                      {p.code}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 shrink-0">
                    {rc.doubled ? rc.thickness * 2 : rc.thickness}mm
                  </span>
                </button>
              );
            })}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Pièces générées
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                {piecesCount} pcs
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Surface nette
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                {totalAreaM2.toFixed(2)} m²
              </span>
            </div>
          </div>

          {/* Save Buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onSaveToLibrary(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>Enregistrer nouveau module</span>
            </button>

            {canOverwrite && (
              <button
                onClick={() => onSaveToLibrary(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                <span>Mettre à jour le module actif</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

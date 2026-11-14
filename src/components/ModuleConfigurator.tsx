import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
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

interface ModuleConfiguratorProps {
  config: ModuleConfig;
  onChange: (updated: ModuleConfig) => void;
  onSaveToLibrary: (overwrite: boolean) => void;
  canOverwrite: boolean;
}

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
  onChange,
  onSaveToLibrary,
  canOverwrite,
}) => {
  const [activeRole, setActiveRole] = useState<PanelRole>('corps');
  const [categoryFilter, setCategoryFilter] = useState<'Toutes' | MaterialCategory>('Toutes');

  const isAsymmetric = !config.sym;

  // Apply partial update and keep derived fields + Blum auto-clearances synced
  const applyConfigUpdate = (partial: Partial<ModuleConfig>) => {
    onChange(syncDerivedConfig({ ...config, ...partial }));
  };

  // Update one independent role (corps, interieur, facades, fond, tiroirs)
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

  // Select a Carlier panel SKU for a specific role
  const handleSelectPanelForRole = (role: PanelRole, panelId: string) => {
    const panel = getPanelById(panelId);
    const current = config.roles[role];
    const defaultFmt = panel.availableFormats[0] || { length: 2800, width: 2070 };

    // Choose realistic thickness depending on role
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
  const selectedHinge = BLUM_HINGES[config.hingeId] || BLUM_HINGES['71B3550'];
  const selectedRunner = BLUM_RUNNERS[config.runnerId] || BLUM_RUNNERS.MOVENTO_BLUMOTION;
  const autoClearancePreview = useMemo(
    () => computeAutoClearances(config.hingeId, config.runnerId, config.tP, config.tTr),
    [config.hingeId, config.runnerId, config.tP, config.tTr]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Dimensions, Géométrie & Plinthe */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              1. Dimensions, Forme & Socle du Caisson
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {config.W} × {config.H} × {config.Dg} mm
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">Nom du module</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => applyConfigUpdate({ name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-medium focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Largeur hors-tout W (mm)
            </label>
            <input
              type="number"
              value={config.W}
              onChange={(e) => applyConfigUpdate({ W: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">Géométrie du volume</label>
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
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:border-amber-500 focus:outline-none"
            >
              <option value="S">Symétrique (Caisson d'équerre standard)</option>
              <option value="A">Asymétrique (Sous-pente / Angle trapèze)</option>
            </select>
          </div>
        </div>

        {/* Left & Right Sides */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/70 border border-sky-500/30 rounded-lg p-3.5 flex flex-col gap-3">
            <span className="text-xs font-bold text-sky-400">◀ Côté gauche (vu de face)</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Hauteur Hg (mm)</label>
                <input
                  type="number"
                  value={config.H}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    applyConfigUpdate({ H: h, ...(config.sym ? { Hd: h } : {}) });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Profondeur Dg (mm)</label>
                <input
                  type="number"
                  value={config.Dg}
                  onChange={(e) => {
                    const d = Number(e.target.value);
                    applyConfigUpdate({ Dg: d, ...(config.sym ? { Dd: d } : {}) });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
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
                ? 'bg-slate-950/70 border-emerald-500/30'
                : 'bg-slate-950/30 border-slate-800 opacity-65'
            }`}
          >
            <span className="text-xs font-bold text-emerald-400">
              Côté droit ▶ {config.sym ? '(= identique au gauche)' : '(Sous-pente)'}
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Hauteur Hd (mm)</label>
                <input
                  type="number"
                  disabled={config.sym}
                  value={config.Hd}
                  onChange={(e) => applyConfigUpdate({ Hd: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono disabled:opacity-40"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Profondeur Dd (mm)</label>
                <input
                  type="number"
                  disabled={config.sym}
                  value={config.Dd}
                  onChange={(e) => applyConfigUpdate({ Dd: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono disabled:opacity-40"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
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

        {/* Plinthe & Fileur Width */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-950/60 border border-slate-800 rounded-lg p-3 items-center">
          <label className="flex items-center gap-2 text-slate-200 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={config.hasPlinth}
              onChange={(e) => applyConfigUpdate({ hasPlinth: e.target.checked })}
              className="w-4 h-4 accent-amber-500"
            />
            <span>Plinthe socle sous caisson</span>
          </label>
          <div>
            <label className="text-slate-400 block mb-1">Hauteur plinthe (mm)</label>
            <input
              type="number"
              disabled={!config.hasPlinth}
              value={config.plinthHeight}
              onChange={(e) => applyConfigUpdate({ plinthHeight: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono disabled:opacity-40"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Retrait façade plinthe (mm)</label>
            <input
              type="number"
              disabled={!config.hasPlinth}
              value={config.plinthSetback}
              onChange={(e) => applyConfigUpdate({ plinthSetback: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono disabled:opacity-40"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Largeur fileurs (mm)</label>
            <input
              type="number"
              value={config.fW}
              onChange={(e) => applyConfigUpdate({ fW: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono"
            />
          </div>
        </div>

        {isAsymmetric && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Plan oblique de toiture</label>
              <select
                value={config.obH}
                onChange={(e) => applyConfigUpdate({ obH: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1.5 rounded"
              >
                <option value="haut">Dessus oblique (Sous-pente mansarde)</option>
                <option value="bas">Dessous oblique (Sous-escalier)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Face oblique profondeur</label>
              <select
                value={config.obq}
                onChange={(e) => applyConfigUpdate({ obq: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1.5 rounded"
              >
                <option value="fond">Fond oblique, façade droite d'équerre</option>
                <option value="avant">Façade oblique, fond droit</option>
              </select>
            </div>
            <div className="flex items-center pt-4">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.trap}
                  onChange={(e) => applyConfigUpdate({ trap: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Panneaux horizontaux en trapèze</span>
              </label>
            </div>
          </div>
        )}
      </section>

      {/* 2. Catalogue Panneaux Carlier Bois — Choix indépendant par rôle */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
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
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium rounded transition-colors"
            title="Copier le panneau Corps vers Intérieur & Tablettes"
          >
            <CopyCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Copier Corps → Intérieur</span>
          </button>
        </div>

        {/* 5 Role Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PANEL_ROLES_META.map((meta) => {
            const rConf = config.roles[meta.role];
            const pnl = getPanelById(rConf.panelId);
            const isActive = activeRole === meta.role;
            const effThickness = rConf.doubled ? rConf.thickness * 2 : rConf.thickness;

            return (
              <button
                key={meta.role}
                onClick={() => setActiveRole(meta.role)}
                className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500 shadow-md'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isActive ? 'text-amber-400' : 'text-slate-200'
                    }`}
                  >
                    {meta.label}
                  </span>
                  <div
                    className="w-4 h-4 rounded border border-slate-600 shrink-0"
                    style={{ backgroundColor: pnl.colorHex }}
                  />
                </div>
                <span className="text-[11px] text-slate-300 font-medium truncate w-full">
                  {pnl.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {effThickness} mm{rConf.doubled ? ' (×2)' : ''} · {rConf.sheetL}×{rConf.sheetW}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Role Detailed Editor */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded border border-slate-600 shadow"
                style={{ backgroundColor: activePanel.colorHex }}
              />
              <div>
                <div className="text-xs font-bold text-amber-400">
                  Configuration : {PANEL_ROLES_META.find((m) => m.role === activeRole)?.label}
                </div>
                <div className="text-[11px] text-slate-400">
                  {activePanel.brand} · {activePanel.code} · ~{activePanel.pricePerM2.toFixed(2)} €/m² HTVA ·{' '}
                  {activePanel.densityKgM3} kg/m³
                </div>
              </div>
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              {activePanel.grain ? 'Sens du fil marqué' : 'Sans sens du fil'}
            </span>
          </div>

          {/* Category Filter + Panel Select */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-4">
              <label className="text-slate-400 font-medium block mb-1">
                Famille de panneaux Carlier
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'Toutes' ? 'Toutes les familles (26 références)' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-8">
              <label className="text-slate-400 font-medium block mb-1">
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
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-medium"
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

          {/* Commercial Format + Editable L x W + Thickness + Grain */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
            <div className="md:col-span-4">
              <label className="text-slate-400 font-medium block mb-1">
                Format commercial usine
              </label>
              <select
                value={
                  activePanel.availableFormats.find(
                    (f) => f.length === activeRoleConf.sheetL && f.width === activeRoleConf.sheetW
                  )
                    ? `${activeRoleConf.sheetL}x${activeRoleConf.sheetW}`
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value === 'custom') return;
                  const [L, W] = e.target.value.split('x').map(Number);
                  updateRole(activeRole, { sheetL: L, sheetW: W });
                }}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
              >
                {activePanel.availableFormats.map((fmt) => (
                  <option key={fmt.label} value={`${fmt.length}x${fmt.width}`}>
                    {fmt.label}
                  </option>
                ))}
                <option value="custom">
                  Format personnalisé ({activeRoleConf.sheetL} × {activeRoleConf.sheetW} mm)
                </option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 font-medium block mb-1">
                Long. brut SL (mm)
              </label>
              <input
                type="number"
                min={300}
                max={6000}
                value={activeRoleConf.sheetL}
                onChange={(e) => updateRole(activeRole, { sheetL: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 font-medium block mb-1">
                Larg. brut SW (mm)
              </label>
              <input
                type="number"
                min={300}
                max={3000}
                value={activeRoleConf.sheetW}
                onChange={(e) => updateRole(activeRole, { sheetW: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-400 font-medium block mb-1">
                Épaisseur (mm)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  min={2}
                  max={60}
                  value={activeRoleConf.thickness}
                  onChange={(e) => updateRole(activeRole, { thickness: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-1.5">
              {(activeRole === 'corps' || activeRole === 'facades') && (
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeRoleConf.doubled}
                    onChange={(e) => updateRole(activeRole, { doubled: e.target.checked })}
                    className="w-3.5 h-3.5 accent-amber-500"
                  />
                  <span>Doublé (×2)</span>
                </label>
              )}
              <label
                className="flex items-center gap-1.5 text-slate-300 cursor-pointer"
                title="Autoriser la rotation à 90° lors de l'optimisation de découpe"
              >
                <input
                  type="checkbox"
                  checked={activeRoleConf.allowRot}
                  onChange={(e) => updateRole(activeRole, { allowRot: e.target.checked })}
                  className="w-3.5 h-3.5 accent-amber-500"
                />
                <span>Rotation calepinage</span>
              </label>
            </div>
          </div>

          {/* Standard Thickness Quick Selector */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-slate-400 mr-1">Épaisseurs stock Carlier :</span>
            {activePanel.standardThicknesses.map((th) => (
              <button
                key={th}
                onClick={() => updateRole(activeRole, { thickness: th })}
                className={`px-2 py-0.5 rounded font-mono border transition-colors ${
                  activeRoleConf.thickness === th
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                {th} mm
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Configurateur Lamello P-System & Assemblage */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              3. Configurateur d'Assemblage Lamello P-System & Usinages
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Zeta P2 / CNC · Fraisage {LAMELLO_SYSTEMS[config.fx].grooveDepthMm} mm
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Fixation du corps (Extérieur)
            </label>
            <select
              value={config.fx}
              onChange={(e) => applyConfigUpdate({ fx: e.target.value as LamelloConnectorId })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
            >
              {Object.values(LAMELLO_SYSTEMS).map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Fixation cloisons & tablettes
            </label>
            <select
              value={config.fxInt}
              onChange={(e) => applyConfigUpdate({ fxInt: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
            >
              <option value="clamex_medius">Lamello Clamex P-14/10 Medius (Cloison ≥16mm)</option>
              <option value="divario_p18">Lamello Divario P-18 (Coulissant invisible ≥18mm)</option>
              <option value="clamex_p14">Lamello Clamex P-14 (Standard)</option>
              <option value="clamex_p10">Lamello Clamex P-10 (Mince ≥12mm)</option>
              <option value="tenso_p14">Lamello Tenso P-14 (Collé invisible)</option>
              <option value="tenso_p10">Lamello Tenso P-10 (Collé mince)</option>
              <option value="taquets_5mm">Taquets métalliques Ø5 mm (Tablettes mobiles)</option>
              <option value="confirmat_7x50">Vis Confirmat 7×50 mm</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Géométrie des angles caisson
            </label>
            <select
              value={config.j}
              onChange={(e) => applyConfigUpdate({ j: e.target.value as JointType })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
            >
              <option value="A">90° — Dessus/dessous couvrent les côtés</option>
              <option value="B">90° — Côtés couvrent dessus/dessous</option>
              <option value="C">45° — Coupe d'onglet (P-System)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Montage du fond ({config.tb} mm)
            </label>
            <select
              value={config.b}
              onChange={(e) => applyConfigUpdate({ b: e.target.value as BackType })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
            >
              <option value="A">Appliqué en feuillure arrière</option>
              <option value="R">Encastré en rainure arrière</option>
              <option value="N">Sans fond (meuble traversant)</option>
            </select>
          </div>
        </div>

        {/* Lamello Validation Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {lamelloChecks.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                msg.level === 'error'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                  : msg.level === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              {msg.level === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : msg.level === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">{msg.title}</span>
                <span className="text-[11px] opacity-90">{msg.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Spacing & Cutter Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950/60 border border-slate-800 rounded-lg p-3 items-center">
          <div>
            <label className="text-slate-400 block mb-1">Marge d'extrémité (mm)</label>
            <input
              type="number"
              value={config.mg}
              onChange={(e) => applyConfigUpdate({ mg: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Entraxe max connecteurs (mm)</label>
            <input
              type="number"
              value={config.es}
              onChange={(e) => applyConfigUpdate({ es: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono"
            />
          </div>
          <div className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300 block">Outillage requis :</span>
            <span>{LAMELLO_SYSTEMS[config.fx].cutterSpec}</span>
          </div>
        </div>
      </section>

      {/* 4. Quincaillerie Blum & Adaptation Automatique des Jeux */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              4. Catalogue Quincaillerie Blum & Adaptation Automatique des Jeux
            </h3>
          </div>

          <button
            onClick={() => applyConfigUpdate({ autoClearances: !config.autoClearances })}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              config.autoClearances
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {config.autoClearances ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            <span>
              Jeux automatiques Blum : {config.autoClearances ? 'Activés' : 'Mode manuel'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Blum Hinge Selector */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-2">
            <label className="text-slate-300 font-bold">Charnières Blum CLIP top</label>
            <select
              value={config.hingeId}
              onChange={(e) => applyConfigUpdate({ hingeId: e.target.value as BlumHingeId })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
            >
              {BLUM_CATALOG.hinges.map((h) => (
                <option key={h.id} value={h.id}>
                  [{h.ref}] {h.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Angle {selectedHinge.openingAngle}° · Finition {selectedHinge.finish} · Ép. porte max{' '}
              {selectedHinge.maxDoorThicknessMm} mm · {selectedHinge.notes}
            </div>
          </div>

          {/* Blum Runner Selector */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-2">
            <label className="text-slate-300 font-bold">
              Coulisses & Systèmes Box Blum
            </label>
            <select
              value={config.runnerId}
              onChange={(e) => applyConfigUpdate({ runnerId: e.target.value as BlumRunnerId })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-2 rounded-lg"
            >
              {BLUM_CATALOG.runners.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.refBase}] {r.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Charge {selectedRunner.loadCapacityKg} kg · {selectedRunner.motionTechnology} ·{' '}
              {selectedRunner.notes}
            </div>
          </div>
        </div>

        {/* Auto-Calibrated Clearances */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">
                Jeu latéral tiroir jlat (mm)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={config.autoClearances}
                value={config.jlat}
                onChange={(e) => applyConfigUpdate({ jlat: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 text-amber-300 px-2.5 py-1.5 rounded font-mono disabled:opacity-75"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Jeu vertical tiroir jvd (mm)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={config.autoClearances}
                value={config.jvd}
                onChange={(e) => applyConfigUpdate({ jvd: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 text-amber-300 px-2.5 py-1.5 rounded font-mono disabled:opacity-75"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Jeu d'ouverture façade jg (mm)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={config.autoClearances}
                value={config.jg}
                onChange={(e) => applyConfigUpdate({ jg: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 text-amber-300 px-2.5 py-1.5 rounded font-mono disabled:opacity-75"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Axe cuvette Ø35 au chant (mm)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={config.autoClearances}
                value={config.hingeCupOffset}
                onChange={(e) => applyConfigUpdate({ hingeCupOffset: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 text-amber-300 px-2.5 py-1.5 rounded font-mono disabled:opacity-75"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex flex-col gap-0.5">
            {autoClearancePreview.notes.map((n, idx) => (
              <span key={idx}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Save to Library Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onSaveToLibrary(false)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg transition-colors"
        >
          <Package className="w-4 h-4" />
          <span>Enregistrer comme nouveau module</span>
        </button>

        {canOverwrite && (
          <button
            onClick={() => onSaveToLibrary(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg shadow transition-colors"
          >
            <span>Mettre à jour le module actif</span>
          </button>
        )}
      </div>
    </div>
  );
};

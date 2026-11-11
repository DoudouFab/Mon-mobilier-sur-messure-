import React from 'react';
import {
  Boxes,
  Compass,
  Layers,
  Package,
  Ruler,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { FastenerType, JointType, ModuleConfig, BackType } from '../types/furniture';
import { CARLIER_PANELS_CATALOG, CarlierPanel } from '../data/carlier-panels';
import { BLUM_CATALOG } from '../data/blum-hardware';
import { R } from '../utils/woodworking-math';

interface ModuleConfiguratorProps {
  config: ModuleConfig;
  onChange: (updated: Partial<ModuleConfig>) => void;
  onSaveToLibrary: (overwrite: boolean) => void;
  canOverwrite: boolean;
}

export const ModuleConfigurator: React.FC<ModuleConfiguratorProps> = ({
  config,
  onChange,
  onSaveToLibrary,
  canOverwrite,
}) => {
  // Apply a panel from Carlier Bois catalog to the configuration
  const handleSelectCarlierPanel = (panelId: string, target: 'corps' | 'portes' | 'interieur') => {
    const panel = CARLIER_PANELS_CATALOG.find((p) => p.id === panelId);
    if (!panel) return;

    const updates: Partial<ModuleConfig> = {};
    const defaultThick = panel.standardThicknesses.includes(19)
      ? 19
      : panel.standardThicknesses.includes(18)
      ? 18
      : panel.standardThicknesses[0];

    if (target === 'corps') {
      updates.SL = panel.sheetLength;
      updates.SW = panel.sheetWidth;
      updates.t0 = defaultThick;
      updates.t = config.dc ? defaultThick * 2 : defaultThick;
      updates.rot = !panel.grain;
    } else if (target === 'portes') {
      updates.t0P = defaultThick;
      updates.tP = config.dp ? defaultThick * 2 : defaultThick;
    } else if (target === 'interieur') {
      updates.tInt = defaultThick;
    }

    onChange(updates);
  };

  const isAsymmetric = !config.sym;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Global Dimensions & Geometry */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              1. Dimensions & Forme du Caisson
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {config.W} × {config.H} × {config.Dg} mm
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Nom du module
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => onChange({ name: e.target.value })}
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
              onChange={(e) => onChange({ W: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Géométrie du volume
            </label>
            <select
              value={config.sym ? 'S' : 'A'}
              onChange={(e) => {
                const isSym = e.target.value === 'S';
                onChange({
                  sym: isSym,
                  Hd: isSym ? config.H : config.Hd,
                  Dd: isSym ? config.Dg : config.Dd,
                });
              }}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:border-amber-500 focus:outline-none"
            >
              <option value="S">⚖️ Symétrique (Caisson d'équerre standard)</option>
              <option value="A">◢ Asymétrique (Sous-pente / Angle trapèze)</option>
            </select>
          </div>
        </div>

        {/* Sides Grid: Left vs Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
          {/* Côté Gauche */}
          <div className="bg-slate-950/70 border border-sky-500/30 rounded-lg p-3.5 flex flex-col gap-3">
            <span className="text-xs font-bold text-sky-400">
              ◀ Côté gauche (vu de face)
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Hauteur Hg (mm)</label>
                <input
                  type="number"
                  value={config.H}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    onChange({ H: h, ...(config.sym ? { Hd: h } : {}) });
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
                    onChange({ Dg: d, ...(config.sym ? { Dd: d } : {}) });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={config.fL}
                onChange={(e) => onChange({ fL: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
              <span>Fileur d'ajustement gauche (+{config.fW}mm)</span>
            </label>
          </div>

          {/* Côté Droit */}
          <div
            className={`border rounded-lg p-3.5 flex flex-col gap-3 transition-opacity ${
              isAsymmetric
                ? 'bg-slate-950/70 border-emerald-500/30'
                : 'bg-slate-950/30 border-slate-800 opacity-60'
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
                  onChange={(e) => onChange({ Hd: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono disabled:opacity-40"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Profondeur Dd (mm)</label>
                <input
                  type="number"
                  disabled={config.sym}
                  value={config.Dd}
                  onChange={(e) => onChange({ Dd: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded font-mono disabled:opacity-40"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                disabled={config.sym}
                checked={config.fR}
                onChange={(e) => onChange({ fR: e.target.checked })}
                className="w-4 h-4 accent-amber-500 disabled:opacity-40"
              />
              <span>Fileur d'ajustement droit (+{config.fW}mm)</span>
            </label>
          </div>
        </div>

        {/* Oblique controls if Asymmetric */}
        {isAsymmetric && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Plan oblique de toiture</label>
              <select
                value={config.obH}
                onChange={(e) => onChange({ obH: e.target.value as any })}
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
                onChange={(e) => onChange({ obq: e.target.value as any })}
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
                  onChange={(e) => onChange({ trap: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Panneaux horizontaux en trapèze</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 2. Carlier Bois Panel Catalog & Thicknesses */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              2. Catalogue Panneaux Carlier Bois (Namur & Suarlée)
            </h3>
          </div>
          <span className="text-xs text-amber-400 font-medium">
            Format brut : {config.SL} × {config.SW} mm
          </span>
        </div>

        {/* Carlier Quick Selection */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Choisir un panneau du stock Carlier Bois :</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Unilin Evola · Egger Eurodekor · Multiplex Riga
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {CARLIER_PANELS_CATALOG.slice(0, 6).map((panel) => (
              <button
                key={panel.id}
                onClick={() => handleSelectCarlierPanel(panel.id, 'corps')}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 hover:border-amber-500/60 bg-slate-900/60 hover:bg-slate-800/80 text-left transition-all group"
              >
                <div
                  className="w-6 h-6 rounded shrink-0 border border-slate-700 shadow-sm mt-0.5"
                  style={{ backgroundColor: panel.colorHex }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-slate-200 group-hover:text-amber-300 truncate">
                    {panel.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {panel.brand} · {panel.sheetLength}×{panel.sheetWidth}mm
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thicknesses Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-medium">
              Épaisseur Corps caisson (mm)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.t0}
                onChange={(e) => {
                  const t0 = Number(e.target.value);
                  onChange({ t0, t: config.dc ? t0 * 2 : t0 });
                }}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-mono"
              />
              <label className="flex items-center gap-1.5 text-slate-400 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.dc}
                  onChange={(e) => {
                    const dc = e.target.checked;
                    onChange({ dc, t: dc ? config.t0 * 2 : config.t0 });
                  }}
                  className="w-3.5 h-3.5 accent-amber-500"
                />
                <span>Doublé (×2)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-medium">
              Épaisseur Intérieur (étagères/cloisons)
            </label>
            <input
              type="number"
              value={config.tInt}
              onChange={(e) => onChange({ tInt: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-medium">
              Épaisseur Portes & Façades (mm)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.t0P}
                onChange={(e) => {
                  const t0P = Number(e.target.value);
                  onChange({ t0P, tP: config.dp ? t0P * 2 : t0P });
                }}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg font-mono"
              />
              <label className="flex items-center gap-1.5 text-slate-400 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.dp}
                  onChange={(e) => {
                    const dp = e.target.checked;
                    onChange({ dp, tP: dp ? config.t0P * 2 : config.t0P });
                  }}
                  className="w-3.5 h-3.5 accent-amber-500"
                />
                <span>Doublé</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Blum Hardware & Assembly Joinery */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              3. Quincaillerie Blum & Assemblage
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Charnières CLIP top & Coulisses MOVENTO
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Système de fixation d'angle
            </label>
            <select
              value={config.fx}
              onChange={(e) => onChange({ fx: e.target.value as FastenerType })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg"
            >
              <option value="Z">Lamello Zeta P2 (Clamex P-14 démontable)</option>
              <option value="V">Vis Confirmat 7×50 mm (avec avant-trou)</option>
              <option value="T">Boîtiers Minifix Ø15 + Tourillons bois</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Assemblage des angles caisson
            </label>
            <select
              value={config.j}
              onChange={(e) => onChange({ j: e.target.value as JointType })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg"
            >
              <option value="A">90° — Dessus/dessous couvrent les côtés</option>
              <option value="B">90° — Côtés couvrent dessus/dessous</option>
              <option value="C">45° — Coupe d'onglet (Lamello P-System)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Type de fond arrière
            </label>
            <select
              value={config.b}
              onChange={(e) => onChange({ b: e.target.value as BackType })}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg"
            >
              <option value="A">Appliqué en feuillure arrière ({config.tb}mm)</option>
              <option value="R">Monté dans rainure 8mm en retrait</option>
              <option value="N">Sans fond (ouvert)</option>
            </select>
          </div>
        </div>

        {/* Blum Systems Summary */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="font-semibold text-slate-300 block mb-1">
              Charnières : Blum CLIP top BLUMOTION
            </span>
            <p className="text-[11px] text-slate-400">
              Perçage cuvette Ø35 mm à 22 mm du bord. Amortisseur silencieux intégré dans le boîtier.
            </p>
          </div>
          <div>
            <span className="font-semibold text-slate-300 block mb-1">
              Coulisses : Blum MOVENTO 40 kg
            </span>
            <p className="text-[11px] text-slate-400">
              Sortie totale synchronisée, jeu latéral calibré à {config.jlat} mm par côté, fermeture douce.
            </p>
          </div>
        </div>
      </div>

      {/* Save to Library Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onSaveToLibrary(false)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg transition-colors"
        >
          <Package className="w-4 h-4" />
          <span>Enregistrer dans la bibliothèque</span>
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

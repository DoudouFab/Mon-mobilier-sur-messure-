import React from 'react';
import {
  CheckSquare,
  Columns,
  DoorClosed,
  MinusCircle,
  Redo,
  RotateCcw,
  Rows,
  Trash2,
  Undo,
} from 'lucide-react';
import { CellContentType, CompartmentNode, DoorPositionType, ModuleConfig } from '../types/furniture';
import { getNode, R, R1 } from '../utils/woodworking-math';

interface SchematicEditorProps {
  config: ModuleConfig;
  tree: CompartmentNode;
  selectedPath: number[];
  multiSelectedPaths: string[];
  isMultiSelect: boolean;
  selectedBoard: { path: number[]; index: number } | null;
  onSelectPath: (path: number[]) => void;
  onToggleMultiSelect: () => void;
  onSelectAllCells: () => void;
  onClearSelection: () => void;
  onSelectBoard: (board: { path: number[]; index: number } | null) => void;
  onApplyDivision: (kind: 'int' | 'mod', cols: number, rows: number) => void;
  onUpdateSelectedCell: (updates: {
    t?: CellContentType;
    p?: number;
    pm?: DoorPositionType;
    rd?: number;
    rh?: number;
    s?: number;
  }) => void;
  onFillShelves: (count: number) => void;
  onFillDrawers: (count: number) => void;
  onApplyGroupDoors: (doorCount: number, position: DoorPositionType) => void;
  onDeleteSelectedBoard: () => void;
  onResetCaisson: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const SchematicEditor: React.FC<SchematicEditorProps> = ({
  config,
  tree,
  selectedPath,
  multiSelectedPaths,
  isMultiSelect,
  selectedBoard,
  onSelectPath,
  onToggleMultiSelect,
  onSelectAllCells,
  onClearSelection,
  onSelectBoard,
  onApplyDivision,
  onUpdateSelectedCell,
  onFillShelves,
  onFillDrawers,
  onApplyGroupDoors,
  onDeleteSelectedBoard,
  onResetCaisson,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const [colsInput, setColsInput] = React.useState<number>(2);
  const [rowsInput, setRowsInput] = React.useState<number>(1);
  const [shelvesCountInput, setShelvesCountInput] = React.useState<number>(3);
  const [drawersCountInput, setDrawersCountInput] = React.useState<number>(3);

  const W = config.W;
  const H = Math.max(config.H, config.Hd || config.H);
  const fs = Math.max(W, H) / 26;

  // Selected Node
  const activeNode = getNode(tree, selectedPath);
  const activeRect = activeNode.cs ? activeNode.i || activeNode.r : activeNode.r;

  // Render SVG Elements recursively
  const renderSvgCells = () => {
    const elements: React.ReactNode[] = [];

    const walk = (n: CompartmentNode) => {
      const pStr = (n.pt || []).join(',');
      const isSelected =
        !selectedBoard &&
        (isMultiSelect
          ? multiSelectedPaths.includes(pStr)
          : selectedPath.join(',') === pStr);

      if (n.cs && n.r) {
        // Cabinet outer frame
        elements.push(
          <rect
            key={`cs-${pStr}`}
            data-p={pStr}
            x={n.r.x}
            y={H - n.r.z - n.r.h}
            width={n.r.w}
            height={n.r.h}
            className="fill-slate-900/60 stroke-amber-500/80 stroke-2 cursor-pointer transition-colors hover:fill-amber-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onSelectBoard(null);
              onSelectPath(n.pt || []);
            }}
          />
        );
      } else if (!n.m && n.r) {
        // Compartment cell
        const y = H - n.r.z - n.r.h;
        elements.push(
          <g key={`cell-${pStr}`}>
            <rect
              data-p={pStr}
              x={n.r.x}
              y={y}
              width={n.r.w}
              height={n.r.h}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'fill-amber-500/20 stroke-amber-400 stroke-[3px]'
                  : 'fill-slate-800/40 hover:fill-slate-700/50 stroke-slate-700/60 stroke-1'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBoard(null);
                onSelectPath(n.pt || []);
              }}
            />

            {/* Visual equipment markers */}
            {n.t === 'tringle' && (
              <line
                x1={n.r.x + 12}
                y1={y + (n.rh !== undefined ? n.rh : 50) + (n.rd || 25) / 2}
                x2={n.r.x + n.r.w - 12}
                y2={y + (n.rh !== undefined ? n.rh : 50) + (n.rd || 25) / 2}
                className="stroke-amber-400 stroke-[6px] stroke-linecap-round pointer-events-none"
              />
            )}

            {n.t === 'tiroir' && (
              <rect
                x={n.r.x + 8}
                y={y + 8}
                width={Math.max(1, n.r.w - 16)}
                height={Math.max(1, n.r.h - 16)}
                className="fill-amber-500/10 stroke-amber-400/80 stroke-1 stroke-dashed pointer-events-none"
              />
            )}

            {Boolean(n.p) && (
              <rect
                x={n.r.x + 10}
                y={y + 10}
                width={Math.max(1, n.r.w - 20)}
                height={Math.max(1, n.r.h - 20)}
                className="fill-none stroke-sky-400/70 stroke-[2px] stroke-dasharray-[10_6] pointer-events-none"
              />
            )}

            {/* Label inside cell */}
            {!n.k && (
              <text
                x={n.r.x + n.r.w / 2}
                y={y + n.r.h / 2 + fs / 3}
                fontSize={fs * 0.75}
                className="fill-slate-300 font-medium text-center pointer-events-none select-none text-anchor-middle"
                textAnchor="middle"
              >
                {n.t === 'tiroir'
                  ? 'Tiroir Blum'
                  : n.t === 'tringle'
                  ? 'Penderie'
                  : n.p
                  ? `${n.p} porte${n.p > 1 ? 's' : ''}`
                  : ''}
              </text>
            )}

            {/* Inner dimensions on hover/selection */}
            {isSelected && n.r && (
              <text
                x={n.r.x + n.r.w / 2}
                y={y + 24}
                fontSize={fs * 0.55}
                className="fill-amber-300 font-mono text-center pointer-events-none select-none"
                textAnchor="middle"
              >
                {R(n.r.w)} × {R(n.r.h)} mm
              </text>
            )}
          </g>
        );
      }

      // Dividers (Shelves & Partitions) as clickable selectable boards
      if (n.k && n.k.length > 0) {
        n.k.forEach(walk);

        if (!n.m) {
          const V = n.d === 'v';
          const g = config.tInt;
          const pad = Math.max(0, (fs * 0.45 - g) / 2);

          for (let i = 0; i < n.k.length - 1; i++) {
            const a = n.k[i].r!;
            const bx = V ? a.x + a.w : a.x;
            const bw = V ? g : a.w;
            const bh = V ? a.h : g;
            const by = H - (V ? a.z : a.z - g) - bh;
            const isBoardSelected =
              selectedBoard &&
              selectedBoard.path.join(',') === pStr &&
              selectedBoard.index === i;

            elements.push(
              <g key={`board-${pStr}-${i}`}>
                {/* Hit area */}
                <rect
                  x={bx - (V ? pad : 0)}
                  y={by - (V ? 0 : pad)}
                  width={bw + (V ? 2 * pad : 0)}
                  height={bh + (V ? 0 : 2 * pad)}
                  className="fill-transparent cursor-pointer hover:fill-amber-400/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBoard({ path: n.pt || [], index: i });
                  }}
                />
                {/* Visual board line */}
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  className={`pointer-events-none transition-colors ${
                    isBoardSelected
                      ? 'fill-amber-400 stroke-amber-300 stroke-1'
                      : 'fill-slate-600 stroke-slate-500'
                  }`}
                />
              </g>
            );
          }
        }
      }
    };

    walk(tree);

    // Sloped ceiling indicator line
    if (Math.abs(config.H - (config.Hd || config.H)) > 0.5) {
      const top = config.obH !== 'bas';
      const y0 = top ? H - config.H : config.H;
      const y1 = top ? H - (config.Hd || config.H) : config.Hd || config.H;
      elements.push(
        <line
          key="slope-line"
          x1="0"
          y1={y0}
          x2={W}
          y2={y1}
          className="stroke-amber-400 stroke-[5px] stroke-dasharray-[16_8] pointer-events-none"
        />
      );
    }

    return elements;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: 2D Interactive Elevation SVG */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        {/* Top Mini Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleMultiSelect}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition-colors ${
                isMultiSelect
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Multisélection : {isMultiSelect ? 'Active' : 'Désactivée'}</span>
            </button>
            <button
              onClick={onSelectAllCells}
              className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded transition-colors"
            >
              Toutes les cases
            </button>
            <button
              onClick={onClearSelection}
              className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded transition-colors"
            >
              Désélectionner
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Annuler (Ctrl+Z)"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Rétablir (Ctrl+Y)"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetCaisson}
              title="Vider et réinitialiser tout l'intérieur"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded transition-colors font-medium ml-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>

        {/* Elevation Canvas Container */}
        <div className="relative bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col items-center justify-center min-h-[460px]">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>
              Élévation de face · {W} × {H} mm
            </span>
            <span className="text-amber-400">
              {selectedBoard
                ? 'Planche intérieure sélectionnée'
                : isMultiSelect
                ? `${multiSelectedPaths.length} case(s) sélectionnée(s)`
                : `Case active : [${selectedPath.map((i) => i + 1).join('.')}]`}
            </span>
          </div>

          <svg
            viewBox={`-30 -30 ${W + 60} ${H + 60}`}
            className="w-full max-h-[500px] h-auto select-none"
          >
            {renderSvgCells()}
          </svg>

          <p className="text-[11px] text-slate-500 mt-3 text-center">
            Touchez ou cliquez sur une case pour la configurer · Cliquez sur une planche pour la supprimer
          </p>
        </div>
      </div>

      {/* Right Column: Case Equipment & Division Inspector */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {selectedBoard ? (
          // Planche spécifique sélectionnée
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-400">
                Planche de séparation sélectionnée
              </h3>
              <button
                onClick={() => onSelectBoard(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fermer
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supprimer cette planche réunira et fusionnera automatiquement les deux compartiments adjacents sans toucher aux autres réglages.
            </p>
            <button
              onClick={onDeleteSelectedBoard}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer cette planche</span>
            </button>
          </div>
        ) : (
          <>
            {/* Division Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-sm font-semibold text-slate-200">
                  Subdivision de la zone
                </span>
                {activeRect && (
                  <span className="text-xs font-mono text-amber-400">
                    {R(activeRect.w)} × {R(activeRect.h)} mm
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">
                    Colonnes en largeur (X)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={colsInput}
                    onChange={(e) => setColsInput(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">
                    Lignes en hauteur (Z)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={rowsInput}
                    onChange={(e) => setRowsInput(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onApplyDivision('int', colsInput, rowsInput)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Diviser (Planches {config.tInt}mm)</span>
                </button>
                <button
                  onClick={() => onApplyDivision('mod', colsInput, rowsInput)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                >
                  <Rows className="w-3.5 h-3.5" />
                  <span>En caissons ({config.t}mm)</span>
                </button>
              </div>
            </div>

            {/* Equipment Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3.5">
              <span className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
                Équipement du compartiment
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Contenu intérieur</label>
                  <select
                    value={activeNode.t || 'vide'}
                    onChange={(e) =>
                      onUpdateSelectedCell({ t: e.target.value as CellContentType })
                    }
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg"
                  >
                    <option value="vide">Ouvert (vide)</option>
                    <option value="tiroir">Tiroir coulissant</option>
                    <option value="tringle">Tringle penderie</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Portes de meuble</label>
                  <select
                    value={activeNode.p || 0}
                    onChange={(e) => onUpdateSelectedCell({ p: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg"
                  >
                    <option value="0">Aucune porte</option>
                    <option value="1">1 porte battante</option>
                    <option value="2">2 portes battantes</option>
                  </select>
                </div>
              </div>

              {Boolean(activeNode.p) && (
                <div className="text-xs">
                  <label className="text-slate-400 block mb-1">
                    Pose des charnières Blum
                  </label>
                  <select
                    value={activeNode.pm || 'in'}
                    onChange={(e) =>
                      onUpdateSelectedCell({ pm: e.target.value as DoorPositionType })
                    }
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg"
                  >
                    <option value="in">Rentrante (dans le cadre intérieur)</option>
                    <option value="ov">En recouvrement (couvre la tranche du caisson)</option>
                  </select>
                </div>
              )}

              {/* Quick Fill Helpers */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400">
                  Remplissage automatique rapide
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={shelvesCountInput}
                    onChange={(e) => setShelvesCountInput(Number(e.target.value))}
                    className="w-16 bg-slate-950 border border-slate-700 text-slate-200 px-2 py-1.5 rounded-lg font-mono text-center"
                  />
                  <button
                    onClick={() => onFillShelves(shelvesCountInput)}
                    className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-colors"
                  >
                    Répartir {shelvesCountInput} étagères égales
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={drawersCountInput}
                    onChange={(e) => setDrawersCountInput(Number(e.target.value))}
                    className="w-16 bg-slate-950 border border-slate-700 text-slate-200 px-2 py-1.5 rounded-lg font-mono text-center"
                  />
                  <button
                    onClick={() => onFillDrawers(drawersCountInput)}
                    className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-colors"
                  >
                    Empiler {drawersCountInput} tiroirs Blum
                  </button>
                </div>
              </div>

              {/* Group Doors Button for multi-selection */}
              {isMultiSelect && multiSelectedPaths.length > 1 && (
                <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>Porte commune sur toute la sélection ({multiSelectedPaths.length} cases)</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => onApplyGroupDoors(1, 'ov')}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded font-medium"
                    >
                      1 grande porte
                    </button>
                    <button
                      onClick={() => onApplyGroupDoors(2, 'ov')}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded font-medium"
                    >
                      2 grandes portes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

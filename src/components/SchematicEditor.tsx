import React from 'react';
import {
  CheckSquare,
  Columns,
  DoorClosed,
  Redo,
  RotateCcw,
  Rows,
  Trash2,
  Undo,
} from 'lucide-react';
import {
  CellContentType,
  CompartmentNode,
  DoorPositionType,
  ModuleConfig,
} from '../types/furniture';
import { getNode, R } from '../utils/woodworking-math';

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

  const activeNode = getNode(tree, selectedPath);
  const activeRect = activeNode.cs ? activeNode.i || activeNode.r : activeNode.r;
  const parentNode =
    selectedPath.length > 0 ? getNode(tree, selectedPath.slice(0, -1)) : null;
  const canSetFixedSize = Boolean(parentNode && parentNode.k && parentNode.k.length > 1);

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
        elements.push(
          <rect
            key={`cs-${pStr}`}
            data-p={pStr}
            x={n.r.x}
            y={H - n.r.z - n.r.h}
            width={n.r.w}
            height={n.r.h}
            className="fill-slate-100/80 dark:fill-slate-900/60 stroke-amber-600 dark:stroke-amber-500/80 stroke-2 cursor-pointer transition-colors hover:fill-amber-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onSelectBoard(null);
              onSelectPath(n.pt || []);
            }}
          />
        );
      } else if (!n.m && n.r) {
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
                  ? 'fill-amber-500/20 stroke-amber-600 dark:stroke-amber-400 stroke-[3px]'
                  : 'fill-white/70 dark:fill-slate-800/40 hover:fill-amber-500/10 dark:hover:fill-slate-700/50 stroke-slate-400 dark:stroke-slate-700/60 stroke-1'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBoard(null);
                onSelectPath(n.pt || []);
              }}
            />

            {n.t === 'tringle' && (
              <line
                x1={n.r.x + 12}
                y1={y + (n.rh !== undefined ? n.rh : 50) + (n.rd || 25) / 2}
                x2={n.r.x + n.r.w - 12}
                y2={y + (n.rh !== undefined ? n.rh : 50) + (n.rd || 25) / 2}
                className="stroke-amber-600 dark:stroke-amber-400 stroke-[6px] stroke-linecap-round pointer-events-none"
              />
            )}

            {n.t === 'tiroir' && (
              <rect
                x={n.r.x + 8}
                y={y + 8}
                width={Math.max(1, n.r.w - 16)}
                height={Math.max(1, n.r.h - 16)}
                className="fill-amber-500/15 stroke-amber-600 dark:stroke-amber-400/80 stroke-1 stroke-dashed pointer-events-none"
              />
            )}

            {Boolean(n.p) && (
              <rect
                x={n.r.x + 10}
                y={y + 10}
                width={Math.max(1, n.r.w - 20)}
                height={Math.max(1, n.r.h - 20)}
                className="fill-none stroke-sky-600 dark:stroke-sky-400/70 stroke-[2px] stroke-dasharray-[10_6] pointer-events-none"
              />
            )}

            {!n.k && (
              <text
                x={n.r.x + n.r.w / 2}
                y={y + n.r.h / 2 + fs / 3}
                fontSize={fs * 0.72}
                className="fill-slate-800 dark:fill-slate-300 font-semibold text-center pointer-events-none select-none"
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

            {isSelected && n.r && (
              <text
                x={n.r.x + n.r.w / 2}
                y={y + 24}
                fontSize={fs * 0.52}
                className="fill-amber-800 dark:fill-amber-300 font-mono font-bold text-center pointer-events-none select-none"
                textAnchor="middle"
              >
                {R(n.r.w)} × {R(n.r.h)} mm{n.s ? ' (fixe)' : ''}
              </text>
            )}
          </g>
        );
      }

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
                <rect
                  x={bx - (V ? pad : 0)}
                  y={by - (V ? 0 : pad)}
                  width={bw + (V ? 2 * pad : 0)}
                  height={bh + (V ? 0 : 2 * pad)}
                  className="fill-transparent cursor-pointer hover:fill-amber-400/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBoard({ path: n.pt || [], index: i });
                  }}
                />
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  className={`pointer-events-none transition-colors ${
                    isBoardSelected
                      ? 'fill-amber-500 stroke-amber-700 dark:stroke-amber-300 stroke-1'
                      : 'fill-slate-400 dark:fill-slate-600 stroke-slate-500'
                  }`}
                />
              </g>
            );
          }
        }
      }
    };

    walk(tree);

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
          className="stroke-amber-600 dark:stroke-amber-400 stroke-[5px] stroke-dasharray-[16_8] pointer-events-none"
        />
      );
    }

    return elements;
  };

  const cardCls =
    'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-md dark:shadow-xl';
  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-2.5 py-1.5 rounded-lg';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: 2D Interactive Elevation SVG */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        {/* Top Mini Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onToggleMultiSelect}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-semibold transition-colors ${
                isMultiSelect
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Multisélection : {isMultiSelect ? 'Active' : 'Désactivée'}</span>
            </button>
            <button
              onClick={onSelectAllCells}
              className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded transition-colors font-medium"
            >
              Tout
            </button>
            <button
              onClick={onClearSelection}
              className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded transition-colors font-medium"
            >
              Vider sél.
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Annuler (Ctrl+Z)"
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-300 rounded"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Rétablir (Ctrl+Y)"
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-300 rounded"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetCaisson}
              title="Vider et réinitialiser tout l'intérieur"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 border border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded transition-colors font-semibold ml-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>

        {/* Elevation Canvas Container */}
        <div className={`${cardCls} flex flex-col items-center justify-center min-h-[460px]`}>
          <div className="w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 font-mono">
            <span>
              Élévation de face · {W} × {H} mm
            </span>
            <span className="text-amber-700 dark:text-amber-400 font-semibold">
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

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 text-center">
            Cliquez sur une case pour la configurer · Cliquez sur une planche intermédiaire pour la supprimer
          </p>
        </div>
      </div>

      {/* Right Column: Case Equipment & Division Inspector */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {selectedBoard ? (
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                Planche de séparation sélectionnée
              </h3>
              <button
                onClick={() => onSelectBoard(null)}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-medium"
              >
                Fermer
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Supprimer cette planche fusionnera automatiquement les deux compartiments adjacents.
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
            <div className={`${cardCls} flex flex-col gap-3`}>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Subdivision de la zone
                </span>
                {activeRect && (
                  <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                    {R(activeRect.w)} × {R(activeRect.h)} mm
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Colonnes en largeur (X)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={colsInput}
                    onChange={(e) => setColsInput(Math.max(1, Number(e.target.value)))}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Lignes en hauteur (Z)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={rowsInput}
                    onChange={(e) => setRowsInput(Math.max(1, Number(e.target.value)))}
                    className={`${inputCls} font-mono`}
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
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  <Rows className="w-3.5 h-3.5" />
                  <span>En caissons ({config.t}mm)</span>
                </button>
              </div>

              {/* Exact Fixed Dimension (s) Control */}
              {canSetFixedSize && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs">
                  <label className="text-slate-700 dark:text-slate-300 font-medium shrink-0">
                    {parentNode?.d === 'v' ? 'Largeur fixe (mm) :' : 'Hauteur fixe (mm) :'}
                  </label>
                  <input
                    type="number"
                    min={60}
                    placeholder="Auto"
                    value={activeNode.s || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateSelectedCell({ s: val > 0 ? val : 0 });
                    }}
                    className={`${inputCls} font-mono py-1 w-24`}
                  />
                  {Boolean(activeNode.s) && (
                    <button
                      onClick={() => onUpdateSelectedCell({ s: 0 })}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700 text-[11px]"
                    >
                      Auto
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Equipment Card */}
            <div className={`${cardCls} flex flex-col gap-3.5`}>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
                Équipement du compartiment
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Contenu intérieur
                  </label>
                  <select
                    value={activeNode.t || 'vide'}
                    onChange={(e) =>
                      onUpdateSelectedCell({ t: e.target.value as CellContentType })
                    }
                    className={inputCls}
                  >
                    <option value="vide">Ouvert (vide)</option>
                    <option value="tiroir">Tiroir ({config.runnerId})</option>
                    <option value="tringle">Tringle penderie</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Portes ({config.hingeId})
                  </label>
                  <select
                    value={activeNode.p || 0}
                    onChange={(e) => onUpdateSelectedCell({ p: Number(e.target.value) })}
                    className={inputCls}
                  >
                    <option value="0">Aucune porte</option>
                    <option value="1">1 porte battante</option>
                    <option value="2">2 portes battantes</option>
                  </select>
                </div>
              </div>

              {Boolean(activeNode.p) && (
                <div className="text-xs">
                  <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
                    Pose des charnières Blum
                  </label>
                  <select
                    value={activeNode.pm || 'in'}
                    onChange={(e) =>
                      onUpdateSelectedCell({ pm: e.target.value as DoorPositionType })
                    }
                    className={inputCls}
                  >
                    <option value="in">Rentrante (dans le cadre intérieur)</option>
                    <option value="ov">En recouvrement (couvre la tranche)</option>
                  </select>
                </div>
              )}

              {/* Quick Fill Helpers */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-400">
                  Remplissage rapide de la case
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={shelvesCountInput}
                    onChange={(e) => setShelvesCountInput(Number(e.target.value))}
                    className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1.5 rounded-lg font-mono text-center"
                  />
                  <button
                    onClick={() => onFillShelves(shelvesCountInput)}
                    className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold transition-colors"
                  >
                    Répartir {shelvesCountInput} étagères
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={drawersCountInput}
                    onChange={(e) => setDrawersCountInput(Number(e.target.value))}
                    className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1.5 rounded-lg font-mono text-center"
                  />
                  <button
                    onClick={() => onFillDrawers(drawersCountInput)}
                    className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold transition-colors"
                  >
                    Empiler {drawersCountInput} tiroirs Blum
                  </button>
                </div>
              </div>

              {isMultiSelect && multiSelectedPaths.length > 1 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>
                      Porte commune ({multiSelectedPaths.length} cases sélectionnées)
                    </span>
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => onApplyGroupDoors(1, 'ov')}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-900 dark:text-amber-300 rounded font-semibold"
                    >
                      1 grande porte
                    </button>
                    <button
                      onClick={() => onApplyGroupDoors(2, 'ov')}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-900 dark:text-amber-300 rounded font-semibold"
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

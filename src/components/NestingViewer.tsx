import React from 'react';
import { AlertTriangle, Compass, RefreshCw, Scissors, Sparkles } from 'lucide-react';
import { ModuleConfig, NestingGroupResult, NestingSheet, PartPiece } from '../types/furniture';
import { R } from '../utils/woodworking-math';

interface NestingViewerProps {
  nestingResults: Record<string, NestingGroupResult>;
  config: ModuleConfig;
  onReoptimize: () => void;
  onOpenSplitter: () => void;
}

export const NestingViewer: React.FC<NestingViewerProps> = ({
  nestingResults,
  config,
  onReoptimize,
  onOpenSplitter,
}) => {
  const allGroups = Object.entries(nestingResults);
  const totalSheets = allGroups.reduce((acc, [, res]) => acc + res.S.length, 0);

  // Collect all parts that could not fit into the sheets
  const oversizedParts: PartPiece[] = [];
  allGroups.forEach(([, res]) => {
    oversizedParts.push(...res.errP);
  });

  const renderSheetSvg = (sheet: NestingSheet, sheetIdx: number) => {
    const SL = config.SL;
    const SW = config.SW;

    return (
      <svg
        key={`sheet-${sheetIdx}`}
        viewBox={`-20 -20 ${SL + 40} ${SW + 40}`}
        className="w-full h-auto bg-slate-950 border border-slate-700/80 rounded-lg shadow-inner my-2 select-none"
      >
        {/* Raw Panel Boundary */}
        <rect
          x={0}
          y={0}
          width={SL}
          height={SW}
          className="fill-slate-900 stroke-amber-500/50 stroke-[3px]"
        />

        {/* Free Reusable Offcut Areas (Chutes) */}
        {sheet.free.map((fr, idx) => {
          if (fr.w < 200 || fr.h < 200) return null;
          return (
            <rect
              key={`free-${idx}`}
              x={fr.x}
              y={fr.y}
              width={fr.w}
              height={fr.h}
              className="fill-emerald-500/5 stroke-emerald-500/30 stroke-1 stroke-dasharray-[12_6]"
            />
          );
        })}

        {/* Placed Pieces */}
        {sheet.items.map((item, itemIdx) => {
          const parts = item.it.comp || [{ p: item.it.p, m: null }];

          return (
            <g
              key={`item-${itemIdx}`}
              transform={`translate(${item.x} ${item.y})`}
            >
              {/* Inner rotation if packed transposed */}
              <g
                transform={
                  item.rt
                    ? `matrix(0 1 -1 0 ${item.it.h} 0)`
                    : undefined
                }
              >
                {parts.map((pt: any, pIdx: number) => {
                  const m = pt.m;
                  const p: PartPiece = pt.p;

                  return (
                    <g
                      key={`part-${pIdx}`}
                      transform={m ? `matrix(${m.join(' ')})` : undefined}
                    >
                      {p.pl ? (
                        <polygon
                          points={p.pl.map((a: any) => `${R(a[0])},${R(a[1])}`).join(' ')}
                          className="fill-slate-800/90 hover:fill-amber-500/20 stroke-amber-400/80 stroke-[2px] transition-colors"
                        />
                      ) : (
                        <rect
                          width={p.L}
                          height={p.l}
                          className="fill-slate-800/90 hover:fill-amber-500/20 stroke-amber-400/80 stroke-[2px] transition-colors"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Centered Piece Label & Code */}
              <text
                x={item.w / 2}
                y={item.h / 2}
                fontSize={Math.max(28, Math.min(item.w, item.h) / 6)}
                className="fill-amber-300 font-bold font-mono text-center pointer-events-none"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {item.it.p.code}
              </text>

              {/* Piece Dimensions at bottom */}
              {item.w > 120 && item.h > 80 && (
                <text
                  x={item.w / 2}
                  y={item.h - 12}
                  fontSize={Math.max(16, Math.min(item.w, item.h) / 12)}
                  className="fill-slate-400 font-mono text-center pointer-events-none"
                  textAnchor="middle"
                >
                  {R(item.w)} × {R(item.h)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header & Re-optimize Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Schéma de Coupe & Calepinage 2D Haute Précision
          </h3>
          <span className="text-xs text-slate-400">
            ({totalSheets} panneau{totalSheets > 1 ? 'x' : ''} requis)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReoptimize}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Chercher un meilleur calepinage</span>
          </button>
        </div>
      </div>

      {/* Warning if parts exceed raw sheet size */}
      {oversizedParts.length > 0 && (
        <div className="bg-rose-500/10 border-2 border-rose-500/40 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>
              {oversizedParts.length} pièce{oversizedParts.length > 1 ? 's' : ''} ne rentre
              {oversizedParts.length > 1 ? 'nt' : ''} pas dans le panneau brut ({config.SL} × {config.SW} mm) !
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Ces pièces dépassent la longueur ou la largeur des panneaux bruts en stock. Vous pouvez autoriser la rotation (si sans sens du fil) ou découper votre caisson en plusieurs modules.
          </p>
          <div className="pt-1">
            <button
              onClick={onOpenSplitter}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              Ouvrir l'assistant de séparation en modules →
            </button>
          </div>
        </div>
      )}

      {/* Sheet Groups by Material */}
      <div className="flex flex-col gap-5">
        {allGroups.map(([materialKey, res]) => {
          const totalAreaM2 = res.area / 1e6;
          const panelAreaM2 = (config.SL * config.SW) / 1e6;
          const totalPanelAreaM2 = res.S.length * panelAreaM2;
          const efficiencyPct = R((100 * res.area) / Math.max(1, totalPanelAreaM2 * 1e6));

          return (
            <div
              key={materialKey}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                <div>
                  <span className="text-sm font-bold text-slate-100">{materialKey}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    · {res.S.length} panneau{res.S.length > 1 ? 'x' : ''} de {config.SL}×{config.SW}mm
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-400">
                    Surface utile : <b className="text-slate-200">{totalAreaM2.toFixed(2)} m²</b>
                  </span>
                  <span className="text-amber-400 font-bold">
                    Rendement : {efficiencyPct} %
                  </span>
                  {res.pairs > 0 && (
                    <span className="text-emerald-400 text-[11px]">
                      {res.pairs} paire(s) oblique(s) tête-bêche
                    </span>
                  )}
                </div>
              </div>

              {/* Render each Sheet */}
              <div className="flex flex-col gap-3">
                {res.S.map((sheet, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-300">
                      Panneau {idx + 1} / {res.S.length}
                    </span>
                    {renderSheetSvg(sheet, idx)}
                  </div>
                ))}
              </div>

              {/* Reusable Offcut note */}
              {res.rem && (
                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between">
                  <span>Plus grande chute récupérable atelier :</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {R(res.rem.w)} × {R(res.rem.h)} mm
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

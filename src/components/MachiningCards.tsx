import React from 'react';
import { Drill, Eye, Ruler } from 'lucide-react';
import { PartPiece } from '../types/furniture';
import { R, R1 } from '../utils/woodworking-math';

interface MachiningCardsProps {
  uniqueGroups: { code: string; p: PartPiece; q: number; names: string[] }[];
  allPieces: PartPiece[];
}

export const MachiningCards: React.FC<MachiningCardsProps> = ({
  uniqueGroups,
  allPieces,
}) => {
  const renderFicheSvg = (p: PartPiece) => {
    const margin = 70;
    const isMitre = p.cut === '45°';

    return (
      <svg
        viewBox={`${-margin} ${-margin} ${p.L + 2 * margin} ${p.l + 2 * margin}`}
        className="w-full h-auto max-h-[220px] bg-slate-950 rounded-lg border border-slate-800 p-2 select-none"
      >
        {/* Piece Outline */}
        {p.pl ? (
          <polygon
            points={p.pl.map((a) => `${R(a[0])},${R(a[1])}`).join(' ')}
            className="fill-slate-900 stroke-amber-500/80 stroke-[3px]"
          />
        ) : (
          <rect
            width={p.L}
            height={p.l}
            className="fill-slate-900 stroke-amber-500/80 stroke-[3px]"
          />
        )}

        {/* Machining / Holes */}
        {p.h.map((h, hIdx) => {
          if (h.k === 'f' || h.k === 'q') {
            const u = R(h.u || 0);
            const v = R(h.v || 0);
            const isHinge = h.d === 35;

            return (
              <g key={`hole-${hIdx}`}>
                {h.k === 'q' ? (
                  <rect
                    x={u - 30}
                    y={v - 6}
                    width={60}
                    height={12}
                    className="fill-amber-400/40 stroke-amber-400 stroke-1"
                  />
                ) : (
                  <circle
                    cx={u}
                    cy={v}
                    r={isHinge ? 17.5 : (h.d || 8) / 2}
                    className={`${
                      isHinge ? 'fill-sky-400/40 stroke-sky-400' : 'fill-amber-400/50 stroke-amber-400'
                    } stroke-1`}
                  />
                )}
                <text
                  x={u + 12}
                  y={v - 10}
                  fontSize={24}
                  className="fill-slate-300 font-mono"
                >
                  {u};{v}
                </text>
              </g>
            );
          }

          const qPos = R(h.pos || 0);
          return (
            <g key={`hole-${hIdx}`}>
              <circle
                cx={h.e === 'g' ? 10 : h.e === 'd' ? p.L - 10 : qPos}
                cy={h.e === 'h' ? 10 : h.e === 'b' ? p.l - 10 : qPos}
                r={6}
                className="fill-amber-400"
              />
            </g>
          );
        })}

        {/* Dimension Labels */}
        <text
          x={p.L / 2}
          y={-20}
          fontSize={32}
          className="fill-amber-400 font-bold font-mono text-center"
          textAnchor="middle"
        >
          {R(p.L)} mm
        </text>
        <text
          transform={`translate(-20 ${p.l / 2}) rotate(-90)`}
          fontSize={32}
          className="fill-amber-400 font-bold font-mono text-center"
          textAnchor="middle"
        >
          {R(p.l)} mm
        </text>

        {isMitre && (
          <text x={40} y={-20} fontSize={28} className="fill-slate-400 font-mono">
            45°
          </text>
        )}
      </svg>
    );
  };

  const getHolesDescription = (p: PartPiece) => {
    if (!p.h || p.h.length === 0) return 'Aucun perçage requis sur cette pièce.';

    const lines: string[] = [];
    const hingeHoles = p.h.filter((h) => h.k === 'f' && h.d === 35);
    const zetaHoles = p.h.filter((h) => h.k === 'q' || h.k === 'p');
    const dowelHoles = p.h.filter((h) => h.k === 'f' && h.d !== 35);

    if (hingeHoles.length > 0) {
      lines.push(
        `${hingeHoles.length} cuvette(s) de charnière Blum Ø35 mm (prof. 12 mm à 22 mm du bord).`
      );
    }
    if (zetaHoles.length > 0) {
      lines.push(
        `${zetaHoles.length} usinage(s) pour connecteurs Lamello Zeta P-System (P-14 / P-10).`
      );
    }
    if (dowelHoles.length > 0) {
      lines.push(`${dowelHoles.length} perçage(s) face Ø5 mm pour taquets / vis.`);
    }

    return lines.join(' ');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Drill className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Fiches d'Usinage & Plans de Perçage Individuels
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Usinages Blum Ø35 mm & Lamello P-System
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {uniqueGroups.map((g) => {
          const p = g.p;
          const assignedSheets = [
            ...new Set(allPieces.filter((x) => x.code === g.code).flatMap((x) => x.sheets || [])),
          ].join(', ');

          return (
            <div
              key={g.code}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3 card-print"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {g.code}
                  </span>
                  <span className="text-xs text-slate-200 font-semibold truncate max-w-[180px]">
                    {g.names.join(' · ')}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300 px-2 py-0.5 bg-slate-800 rounded">
                  × {g.q}
                </span>
              </div>

              {/* Graphic Drawing */}
              {renderFicheSvg(p)}

              {/* Specs */}
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Matière :</span>
                  <span className="text-slate-200 font-medium">{p.mat}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Dimensions finies :</span>
                  <span className="font-mono text-slate-200">
                    {R(p.L)} × {R(p.l)} × {R1(p.bt)} mm
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Panneau calepinage :</span>
                  <span className="text-amber-400 font-mono text-[11px]">
                    {assignedSheets || 'Hors format'}
                  </span>
                </div>
                {p.note && <p className="text-[11px] text-slate-400 mt-1 italic">{p.note}</p>}
                <p className="text-[11px] text-amber-300/90 mt-1 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  {getHolesDescription(p)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

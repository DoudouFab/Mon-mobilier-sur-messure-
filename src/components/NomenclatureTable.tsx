import React from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ListOrdered,
  Printer,
  Wrench,
} from 'lucide-react';
import { BuiltModuleResult, HardwareItem, PartPiece } from '../types/furniture';
import { R, R1 } from '../utils/woodworking-math';

interface NomenclatureTableProps {
  modules: BuiltModuleResult[];
  allPieces: PartPiece[];
  uniqueGroups: { code: string; p: PartPiece; q: number; names: string[]; placed: number }[];
  hardwareSummary: Record<string, number>;
  onPrint: () => void;
}

export const NomenclatureTable: React.FC<NomenclatureTableProps> = ({
  modules,
  allPieces,
  uniqueGroups,
  hardwareSummary,
  onPrint,
}) => {
  // Export CSV for CNC / Saw format or Excel
  const exportCsv = () => {
    const headers = [
      'Repere',
      'Designation',
      'Matiere',
      'Longueur_mm',
      'Largeur_mm',
      'Epaisseur_mm',
      'Quantite',
      'Angle_Coupe',
      'Chants',
      'Calepinage_Panneau',
    ];

    const rows = uniqueGroups.map((g) => {
      const p = g.p;
      const sheets = [
        ...new Set(allPieces.filter((x) => x.code === g.code).flatMap((x) => x.sheets || [])),
      ].join('; ');

      return [
        `"${g.code}"`,
        `"${g.names.join(' / ')}"`,
        `"${p.matName || p.mat}"`,
        R(p.L),
        R(p.l),
        R1(p.bt),
        g.q,
        `"${p.cut}"`,
        `"Chant avant 1mm"`,
        `"${sheets || 'Hors format'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `debit_mobilier_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeConfig = modules[0]?.cf;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 noprint">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Dossier Technique d'Atelier & Fiches de Débit
          </h3>
          <span className="text-xs text-slate-400">
            · {allPieces.length} pièces au total ({uniqueGroups.length} références uniques)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg shadow transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exporter en CSV (Excel / Scie)</span>
          </button>
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer Dossier A4 / PDF</span>
          </button>
        </div>
      </div>

      {/* Cartouche d'Atelier */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 card-print">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
            Projet Mobilier Sur-Mesure
          </span>
          <h2 className="text-lg font-bold text-slate-100">
            {modules.length > 1 ? `Ensemble Mobilier (${modules.length} modules)` : modules[0]?.name || 'Caisson'}
          </h2>
          <span className="text-xs text-slate-400">
            Établi le {new Date().toLocaleDateString('fr-BE')} · Dimensions en millimètres (mm)
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-slate-400">Modules assemblés :</span>
            <span className="text-amber-400 font-bold text-sm">{modules.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Pièces à débiter :</span>
            <span className="text-slate-100 font-bold text-sm">{allPieces.length}</span>
          </div>
        </div>
      </div>

      {/* Nomenclature Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl card-print">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-100">
            Feuille de Débit Complète (Nomenclature Panneaux Carlier Bois)
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="py-2.5 px-3 font-semibold">Repère</th>
                <th className="py-2.5 px-3 font-semibold">Désignation</th>
                <th className="py-2.5 px-3 font-semibold">Panneau Carlier Bois</th>
                <th className="py-2.5 px-3 font-semibold text-right">L (mm)</th>
                <th className="py-2.5 px-3 font-semibold text-right">l (mm)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Ép.</th>
                <th className="py-2.5 px-3 font-semibold text-center">Qté</th>
                <th className="py-2.5 px-3 font-semibold">Coupe</th>
                <th className="py-2.5 px-3 font-semibold">Calepinage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
              {uniqueGroups.map((g) => {
                const p = g.p;
                const sheets = [
                  ...new Set(
                    allPieces.filter((x) => x.code === g.code).flatMap((x) => x.sheets || [])
                  ),
                ].join(', ');

                return (
                  <tr key={g.code} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-amber-400">{g.code}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                      {g.names.join(' · ')}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">
                      {p.matName || p.mat}
                    </td>
                    <td className="py-2.5 px-3 text-right">{R(p.L)}</td>
                    <td className="py-2.5 px-3 text-right">{R(p.l)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {R1(p.bt)}
                      {p.mult > 1 ? ' ×2' : ''}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-100">
                      {g.q}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">
                      {p.cut}
                      {p.pl ? ' · trapèze' : ''}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px]">
                      {g.placed >= g.q ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{sheets || 'Placé'}</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold">
                          ⚠ Hors format ({g.placed}/{g.q})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hardware Summary (Quincaillerie Blum & Assemblage) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl card-print">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
          <Wrench className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-slate-100">
            Liste Complète de Quincaillerie & Ferrures (Blum & Lamello P-System)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {Object.entries(hardwareSummary).map(([item, qty]) => (
            <div
              key={item}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 font-sans"
            >
              <span className="text-slate-300">{item}</span>
              <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 ml-2 shrink-0">
                × {qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step-by-Step Assembly Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl card-print">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
          <ListOrdered className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-slate-100">
            Notice de Montage et Procédure d'Assemblage Atelier
          </h4>
        </div>

        <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans">
          <li>
            <b>Débit et plaquage de chants :</b> Débiter chaque famille de panneaux selon son format commercial optimisé. Plaquer les chants apparents (ABS assorti Carlier Bois).
          </li>
          <li>
            <b>Usinages Blum & Lamello P-System :</b> Réaliser les perçages cuvette Blum Ø35 mm à{' '}
            {activeConfig?.hingeCupOffset ?? 22} mm du bord et les fraisages Lamello P-System / perçages selon les fiches d'usinage.
          </li>
          <li>
            <b>Assemblage du caisson :</b> Positionner le dessous et les deux côtés. Enclencher les connecteurs {activeConfig?.fx || 'Lamello P-System'} et verrouiller.
          </li>
          <li>
            <b>Montage des cloisons et étagères intérieures :</b> Installer les séparations verticales et tablettes ({activeConfig?.fxInt === 'taquets_5mm' ? 'taquets Ø5 mm' : activeConfig?.fxInt || 'P-System'}).
          </li>
          <li>
            <b>Pose du dessus et du fond :</b> Emboîter le dessus puis fixer le panneau de fond ({activeConfig?.tb ?? 8} mm) selon le type choisi (applique ou rainure).
          </li>
          <li>
            <b>Pose des coulisses et tiroirs Blum :</b> Fixer les coulisses Blum ({activeConfig?.runnerId || 'MOVENTO'}) avec jeu latéral calibré à {activeConfig?.jlat ?? 5} mm et vertical à {activeConfig?.jvd ?? 14} mm.
          </li>
          <li>
            <b>Montage et réglage des portes :</b> Clipser les charnières Blum ({activeConfig?.hingeId || '71B3550'}) et calibrer le jeu d'ouverture ({activeConfig?.jg ?? 2} mm).
          </li>
          {modules.length > 1 && (
            <li>
              <b>Jonction des modules :</b> Solidariser les caissons accolés par vis de liaison Ø5 mm.
            </li>
          )}
        </ol>
      </div>
    </div>
  );
};

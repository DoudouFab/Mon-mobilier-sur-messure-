import React from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Info,
  ListOrdered,
  Printer,
  Wrench,
} from 'lucide-react';
import { BuiltModuleResult, PartPiece } from '../types/furniture';
import { R, R1 } from '../utils/woodworking-math';

interface NomenclatureGroup {
  code: string;
  p: PartPiece;
  q: number;
  names: string[];
  instanceCodes: string[];
  placed: number;
}

interface NomenclatureTableProps {
  modules: BuiltModuleResult[];
  allPieces: PartPiece[];
  uniqueGroups: NomenclatureGroup[];
  hardwareSummary: Record<string, number>;
  onPrint: () => void;
  onOpenQuote?: () => void;
}

export const NomenclatureTable: React.FC<NomenclatureTableProps> = ({
  modules,
  allPieces,
  uniqueGroups,
  hardwareSummary,
  onPrint,
  onOpenQuote,
}) => {
  const exportCsv = () => {
    const headers = [
      'Repere',
      'Repere_Pieces',
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
        `"${g.instanceCodes.join(' ')}"`,
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

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `debit_mobilier_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeConfig = modules[0]?.cf;
  const cardCls =
    'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-md dark:shadow-xl card-print';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-md dark:shadow-xl flex flex-wrap items-center justify-between gap-3 noprint">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Dossier Technique d'Atelier & Fiches de Débit
          </h3>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            · {allPieces.length} pièces ({uniqueGroups.length} références)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Exporter CSV (Excel / Scie)</span>
          </button>
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer A4 / PDF</span>
          </button>
          {onOpenQuote && (
            <button
              onClick={onOpenQuote}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Créer le devis client →</span>
            </button>
          )}
        </div>
      </div>

      {/* Cartouche + Nomenclature Legend */}
      <div className={`${cardCls} p-4 flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block">
              Projet Mobilier Sur-Mesure
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {modules.length > 1
                ? `Ensemble Mobilier (${modules.length} modules)`
                : modules[0]?.name || 'Caisson'}
            </h2>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Établi le {new Date().toLocaleDateString('fr-BE')} · Dimensions en millimètres (mm)
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-slate-500 dark:text-slate-400">Modules assemblés :</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold text-sm">
                {modules.length}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 dark:text-slate-400">Pièces à débiter :</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold text-sm">
                {allPieces.length}
              </span>
            </div>
          </div>
        </div>

        {/* Code Legend */}
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-[11px] text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>Codification atelier [Module]-[Zone],[Position],[N°][lettre] (ex : B-1,2,1c) :</span>
          </span>
          <span>
            <b>Zone :</b> 1=Caisson · 2=Intérieur · 3=Fond · 4=Extérieur
          </span>
          <span>
            <b>Position :</b> 1=Vertical · 2=Horizontal · 3=Autre (frontal/oblique)
          </span>
          <span>
            <b>Lettre a, b, c… :</b> ordre de gauche à droite / bas en haut
          </span>
        </div>
      </div>

      {/* Nomenclature Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Feuille de Débit Complète (Nomenclature Panneaux Carlier Bois)
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-b border-slate-300 dark:border-slate-800">
                <th className="py-2.5 px-3 font-semibold">Repère (a,b,c…)</th>
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
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-slate-900 dark:text-slate-200">
              {uniqueGroups.map((g) => {
                const p = g.p;
                const sheets = [
                  ...new Set(
                    allPieces.filter((x) => x.code === g.code).flatMap((x) => x.sheets || [])
                  ),
                ].join(', ');

                return (
                  <tr
                    key={g.code}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-amber-700 dark:text-amber-400">{g.code}</div>
                      {g.instanceCodes.length > 1 && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {g.instanceCodes.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-200">
                      {g.names.join(' · ')}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                      {p.matName || p.mat}
                    </td>
                    <td className="py-2.5 px-3 text-right">{R(p.L)}</td>
                    <td className="py-2.5 px-3 text-right">{R(p.l)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {R1(p.bt)}
                      {p.mult > 1 ? ' ×2' : ''}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">{g.q}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      {p.cut}
                      {p.pl ? ' · trapèze' : ''}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px]">
                      {g.placed >= g.q ? (
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{sheets || 'Placé'}</span>
                        </span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-400 font-semibold">
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

      {/* Hardware Summary */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
          <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Liste Complète de Quincaillerie & Ferrures (Blum & Lamello P-System)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {Object.entries(hardwareSummary).map(([item, qty]) => (
            <div
              key={item}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800 font-sans"
            >
              <span className="text-slate-800 dark:text-slate-300">{item}</span>
              <span className="font-mono font-bold text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/15 ml-2 shrink-0">
                × {qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step-by-Step Assembly Instructions */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
          <ListOrdered className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Notice de Montage et Procédure d'Assemblage Atelier
          </h4>
        </div>

        <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
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
            <b>Montage des cloisons et étagères intérieures :</b> Installer les séparations verticales et tablettes ({activeConfig?.fxInt === 'taquets_5mm' ? 'taquets Ø5 mm' : activeConfig?.fxInt || 'P-System'}) en suivant l'ordre alphabétique (a, b, c… de gauche à droite / bas en haut).
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

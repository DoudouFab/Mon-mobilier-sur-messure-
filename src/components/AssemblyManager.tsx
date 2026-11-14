import React from 'react';
import {
  Boxes,
  Copy,
  Edit3,
  Link as LinkIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { AssemblyPlacement, LibraryItem } from '../types/furniture';
import { R } from '../utils/woodworking-math';

interface AssemblyManagerProps {
  library: LibraryItem[];
  assembly: AssemblyPlacement[];
  onAddModule: (
    modId: number,
    anchorIndex: number,
    face: 'right' | 'left' | 'top',
    rot: 0 | 90 | 180 | 270
  ) => void;
  onRemoveAssemblyModule: (index: number) => void;
  onClearAssembly: () => void;
  onEditLibraryModule: (index: number) => void;
  onDuplicateLibraryModule: (index: number) => void;
  onDeleteLibraryModule: (index: number) => void;
}

export const AssemblyManager: React.FC<AssemblyManagerProps> = ({
  library,
  assembly,
  onAddModule,
  onRemoveAssemblyModule,
  onClearAssembly,
  onEditLibraryModule,
  onDuplicateLibraryModule,
  onDeleteLibraryModule,
}) => {
  const [selectedTargetLib, setSelectedTargetLib] = React.useState<number>(0);
  const [selectedAnchorMod, setSelectedAnchorMod] = React.useState<number>(
    assembly.length > 0 ? assembly.length - 1 : -1
  );
  const [selectedFace, setSelectedFace] = React.useState<'right' | 'left' | 'top'>('right');
  const [selectedRot, setSelectedRot] = React.useState<0 | 90 | 180 | 270>(0);

  const x0 = Math.min(0, ...assembly.map((m) => m.x));
  const totW = Math.max(1200, ...assembly.map((m) => m.x + m.w + 200));
  const totH = Math.max(1200, ...assembly.map((m) => m.z + m.h + 200));
  const fs = Math.max(totW - x0, totH) / 36;

  const cardCls =
    'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-5 shadow-md dark:shadow-xl';
  const selectCls =
    'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-2.5 py-1.5 rounded';

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Saved Library */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Bibliothèque des Modules Enregistrés
            </h3>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {library.length} module{library.length > 1 ? 's' : ''}
          </span>
        </div>

        {library.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-400 italic">
            Aucun module enregistré. Concevez votre module dans l'onglet « 1. Conception » puis cliquez sur « Enregistrer ».
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {library.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3 shadow-sm"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {item.name}
                  </h4>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                    {item.config.W} × {item.config.H} × {item.config.Dg} mm
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                  <button
                    onClick={() => onAddModule(idx, assembly.length - 1, 'right', 0)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditLibraryModule(idx)}
                      title="Modifier dans le studio"
                      className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDuplicateLibraryModule(idx)}
                      title="Dupliquer"
                      className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteLibraryModule(idx)}
                      title="Supprimer"
                      className="p-1.5 bg-rose-100 dark:bg-rose-500/15 hover:bg-rose-200 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Assembling Modules */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Assemblage par Faces & Accrochage de Caissons
            </h3>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-semibold">
            {assembly.length} module{assembly.length > 1 ? 's' : ''} dans l'armoire
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-lg border border-slate-300 dark:border-slate-800">
          <div>
            <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
              Module à placer
            </label>
            <select
              value={selectedTargetLib}
              onChange={(e) => setSelectedTargetLib(Number(e.target.value))}
              className={selectCls}
            >
              {library.map((item, i) => (
                <option key={i} value={i}>
                  {item.name} ({item.config.W}×{item.config.H}mm)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
              Module de référence
            </label>
            <select
              value={selectedAnchorMod}
              onChange={(e) => setSelectedAnchorMod(Number(e.target.value))}
              className={selectCls}
            >
              <option value="-1">Premier module (Origine 0,0)</option>
              {assembly.map((am, i) => (
                <option key={i} value={i}>
                  {String.fromCharCode(65 + (i % 26))}. {am.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
              Face de jonction
            </label>
            <select
              value={selectedFace}
              onChange={(e) => setSelectedFace(e.target.value as any)}
              className={selectCls}
            >
              <option value="right">À droite du module de référence</option>
              <option value="left">À gauche du module de référence</option>
              <option value="top">Au-dessus (empilé verticalement)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-400 font-medium block mb-1">
              Orientation / Rotation
            </label>
            <select
              value={selectedRot}
              onChange={(e) => setSelectedRot(Number(e.target.value) as any)}
              className={selectCls}
            >
              <option value="0">0° (Face avant standard)</option>
              <option value="90">90° vers la droite</option>
              <option value="180">180° (Retourné)</option>
              <option value="270">270° vers la gauche</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              onAddModule(selectedTargetLib, selectedAnchorMod, selectedFace, selectedRot)
            }
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Coller et positionner sur la face</span>
          </button>

          {assembly.length > 0 && (
            <button
              onClick={onClearAssembly}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 text-xs font-semibold rounded-lg transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider l'armoire</span>
            </button>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px]">
          {assembly.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Aucun module dans l'armoire. Ajoutez un module depuis la bibliothèque ci-dessus.
            </p>
          ) : (
            <svg
              viewBox={`${x0 - 50} -50 ${totW - x0 + 100} ${totH + 100}`}
              className="w-full max-h-[380px] select-none"
            >
              {assembly.map((am, i) => (
                <g key={i}>
                  <rect
                    x={am.x}
                    y={totH - am.z - am.h}
                    width={am.w}
                    height={am.h}
                    className="fill-white dark:fill-slate-900/90 stroke-amber-600 dark:stroke-amber-500 stroke-[3px]"
                  />
                  <text
                    x={am.x + am.w / 2}
                    y={totH - am.z - am.h / 2}
                    fontSize={fs}
                    className="fill-slate-900 dark:fill-slate-200 font-bold font-mono text-center pointer-events-none"
                    textAnchor="middle"
                  >
                    {String.fromCharCode(65 + (i % 26))} · {am.name}
                  </text>
                  <text
                    x={am.x + am.w / 2}
                    y={totH - am.z - 16}
                    fontSize={fs * 0.65}
                    className="fill-slate-600 dark:fill-slate-400 font-mono text-center pointer-events-none"
                    textAnchor="middle"
                  >
                    {R(am.w)} × {R(am.h)} mm
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>

        {assembly.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-300">
              Liste des caissons placés :
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {assembly.map((am, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                      {String.fromCharCode(65 + (i % 26))}
                    </span>
                    <span className="text-slate-900 dark:text-slate-200 font-semibold">
                      {am.name}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      (X={R(am.x)}, Z={R(am.z)})
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveAssemblyModule(i)}
                    title="Retirer de l'armoire"
                    className="p-1 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

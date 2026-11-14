import React from 'react';
import { AlertCircle, CheckCircle2, Scissors } from 'lucide-react';
import { CompartmentNode, ModuleConfig } from '../types/furniture';
import { computeNesting } from '../utils/nesting';
import { createGrid, R, R1 } from '../utils/woodworking-math';

interface AutoSplitterProps {
  config: ModuleConfig;
  tree: CompartmentNode;
  onApplySplit: (path: number[], newGrid: CompartmentNode) => void;
  onOpenAménagement: () => void;
}

interface SplitProposal {
  lab: string;
  ws: number[];
  hs: number[];
  eq: boolean;
  sh?: number;
  ut?: number;
  key?: string;
}

export const AutoSplitter: React.FC<AutoSplitterProps> = ({
  config,
  tree,
  onApplySplit,
  onOpenAménagement,
}) => {
  const [colsCount, setColsCount] = React.useState<number>(2);
  const [rowsCount, setRowsCount] = React.useState<number>(1);

  const corpsSL = config.roles?.corps?.sheetL || config.SL;
  const corpsSW = config.roles?.corps?.sheetW || config.SW;
  const corpsRot = config.roles?.corps?.allowRot ?? config.rot;

  const fitP = (a: number, b: number) => {
    const L = Math.max(a, b);
    const l = Math.min(a, b);
    return (
      (L <= corpsSL && l <= corpsSW) ||
      (corpsRot && l <= corpsSL && L <= corpsSW)
    );
  };

  const getCarcaseParts = (w: number, h: number) => {
    const t = config.t;
    const D = Math.max(config.Dg, config.Dd);
    const iw = w - 2 * t;
    const ih = h - 2 * t;
    const parts =
      config.j === 'A'
        ? [
            [ih, D],
            [ih, D],
            [w, D],
            [w, D],
          ]
        : config.j === 'B'
        ? [
            [h, D],
            [h, D],
            [iw, D],
            [iw, D],
          ]
        : [
            [h, D],
            [h, D],
            [w, D],
            [w, D],
          ];
    if (config.b === 'A' || config.b === 'R') parts.push([w, h]);
    return parts;
  };

  const carcFit = (w: number, h: number) =>
    getCarcaseParts(w, h).every((x) => fitP(x[0], x[1]));

  const csNodes: { n: CompartmentNode; fit: boolean; proposals: SplitProposal[] }[] = [];

  const computeProposals = (w: number, h: number): SplitProposal[] => {
    const eq = (a: number, b: number): SplitProposal => ({
      ws: Array(a).fill(R1(w / a)),
      hs: Array(b).fill(R1(h / b)),
      eq: true,
      lab: '',
    });

    const allValid: [number, number][] = [];
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        if ((a > 1 || b > 1) && carcFit(w / a, h / b)) {
          allValid.push([a, b]);
        }
      }
    }

    if (!allValid.length) return [];

    const sim = (o: SplitProposal) => {
      const pcs: any[] = [];
      o.ws.forEach((x) =>
        o.hs.forEach((y) =>
          getCarcaseParts(x, y).forEach((d) =>
            pcs.push({
              L: Math.max(...d),
              l: Math.min(...d),
              mat: 'x',
              matName: 'x',
              sheetL: corpsSL,
              sheetW: corpsSW,
              allowRot: corpsRot,
              bt: 1,
              name: 'x',
              mult: 1,
            })
          )
        )
      );
      const res = Object.values(computeNesting(pcs, config, 0))[0];
      if (res) {
        o.sh = res.S.length;
        o.ut = R(
          (100 * pcs.reduce((a, p) => a + p.L * p.l, 0)) /
            (Math.max(1, res.S.length) * corpsSL * corpsSW)
        );
      }
      return o;
    };

    const out: SplitProposal[] = [];
    const addProp = (lab: string, o?: SplitProposal) => {
      if (!o) return;
      const key = o.ws.join() + '/' + o.hs.join();
      if (out.some((q) => q.key === key)) return;
      o.lab = lab;
      o.key = key;
      out.push(sim(o));
    };

    const best = allValid.reduce((x, y) =>
      y[0] * y[1] < x[0] * x[1] ||
      (y[0] * y[1] === x[0] * x[1] && Math.max(...y) < Math.max(...x))
        ? y
        : x
    );
    addProp('Équilibré (moins de caissons)', eq(...best));

    const col = allValid.find((q) => q[1] === 1);
    if (col) addProp('Côte à côte seulement (colonnes)', eq(col[0], 1));

    const row = allValid.find((q) => q[0] === 1);
    if (row) addProp('Empilés seulement (niveaux)', eq(1, row[1]));

    return out;
  };

  (function find(n: CompartmentNode) {
    if (n.cs && n.r) {
      const fit = carcFit(n.r.w, n.r.h);
      csNodes.push({
        n,
        fit,
        proposals: fit ? [] : computeProposals(n.r.w, n.r.h),
      });
    } else if (n.k) {
      n.k.forEach(find);
    }
  })(tree);

  const oversizedCount = csNodes.filter((q) => !q.fit).length;

  const handleApplyProposal = (node: CompartmentNode, prop: SplitProposal) => {
    const g = createGrid(prop.ws.length, prop.hs.length);
    if (!prop.eq) {
      const rows = g.m && g.d === 'h' ? g.k! : [g];
      rows.forEach((r, y) => {
        if (prop.hs.length > 1) r.s = prop.hs[y];
        const cols = r.m && r.d === 'v' ? r.k! : [r];
        cols.forEach((cc, x) => {
          if (prop.ws.length > 1) cc.s = prop.ws[x];
        });
      });
    }
    if (node.s) g.s = node.s;
    onApplySplit(node.pt || [], g);
  };

  const cardCls =
    'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-5 shadow-md dark:shadow-xl';

  return (
    <div className="flex flex-col gap-6">
      <div className={`${cardCls} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Assistant de Séparation Automatique en Modules
            </h3>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded ${
              oversizedCount > 0
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
                : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
            }`}
          >
            {oversizedCount > 0
              ? `⚠ ${oversizedCount} caisson${oversizedCount > 1 ? 's' : ''} trop grand${oversizedCount > 1 ? 's' : ''}`
              : '✓ Tous les panneaux rentrent dans le format brut'}
          </span>
        </div>

        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          Lorsqu'un dressing ou une bibliothèque dépasse les dimensions maximales des panneaux bruts ({corpsSL} × {corpsSW} mm), il est utile de le subdiviser en modules caissons indépendants.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {csNodes.map((item, idx) => {
          const w = item.n.r?.w || config.W;
          const h = item.n.r?.h || config.H;

          return (
            <div
              key={idx}
              className={`rounded-xl p-5 shadow-md dark:shadow-xl border flex flex-col gap-4 bg-white dark:bg-slate-900 ${
                item.fit
                  ? 'border-slate-300 dark:border-slate-800'
                  : 'border-rose-400 dark:border-rose-500/50'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Caisson {idx + 1} : {R(w)} × {R(h)} mm
                </span>
                {item.fit ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Rentre dans le panneau brut</span>
                  </span>
                ) : (
                  <span className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Dépasse {corpsSL}×{corpsSW} mm</span>
                  </span>
                )}
              </div>

              {!item.fit && item.proposals.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    Propositions de découpe recommandées :
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {item.proposals.map((prop, pIdx) => (
                      <div
                        key={pIdx}
                        className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 flex flex-col justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-200 block mb-1">
                            {prop.lab}
                          </span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-mono">
                            {prop.ws.length} col. × {prop.hs.length} rangées
                          </span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                            ({prop.ws.map(R).join(' / ')} × {prop.hs.map(R).join(' / ')} mm)
                          </span>
                        </div>
                        <button
                          onClick={() => handleApplyProposal(item.n, prop)}
                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow transition-colors"
                        >
                          Appliquer ce découpage
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 flex flex-col gap-3 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-300">
                  Ou diviser manuellement en modules égaux :
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Colonnes (X) :</span>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={colsCount}
                      onChange={(e) => setColsCount(Number(e.target.value))}
                      className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 rounded font-mono text-center"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Rangées (Z) :</span>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={rowsCount}
                      onChange={(e) => setRowsCount(Number(e.target.value))}
                      className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 rounded font-mono text-center"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const prop: SplitProposal = {
                        lab: 'Manuel',
                        ws: Array(colsCount).fill(R1(w / colsCount)),
                        hs: Array(rowsCount).fill(R1(h / rowsCount)),
                        eq: true,
                      };
                      handleApplyProposal(item.n, prop);
                    }}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 rounded border border-slate-300 dark:border-slate-700 font-semibold"
                  >
                    Appliquer {colsCount} × {rowsCount} modules
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onOpenAménagement}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg transition-colors"
        >
          Passer à l'aménagement intérieur →
        </button>
      </div>
    </div>
  );
};

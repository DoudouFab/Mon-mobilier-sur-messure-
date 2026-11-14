import {
  ModuleConfig,
  NestingGroupResult,
  NestingSheet,
  PartPiece,
} from '../types/furniture';
import { R, R1 } from './woodworking-math';

export const polyArea = (pl: [number, number][]) => {
  let a = 0;
  for (let i = 0; i < pl.length; i++) {
    const p = pl[i];
    const q = pl[(i + 1) % pl.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

export function mateTrapezoid(p: PartPiece) {
  const pl = p.pl;
  if (!pl || pl.length !== 4) return null;
  let best: any = null;

  for (let i = 0; i < 4; i++) {
    const A = pl[i];
    const B = pl[(i + 1) % 4];
    const sx = A[0] + B[0];
    const sy = A[1] + B[1];
    const pts = pl.concat(pl.map((a) => [sx - a[0], sy - a[1]]));
    const mnx = Math.min(...pts.map((a) => a[0]));
    const mny = Math.min(...pts.map((a) => a[1]));
    const Wc = Math.max(...pts.map((a) => a[0])) - mnx;
    const Hc = Math.max(...pts.map((a) => a[1])) - mny;

    if (!best || Wc * Hc < best.Wc * best.Hc) {
      best = {
        Wc,
        Hc,
        m1: [1, 0, 0, 1, -mnx, -mny],
        m2: [-1, 0, 0, -1, sx - mnx, sy - mny],
      };
    }
  }

  return best && best.Wc * best.Hc < 0.92 * 2 * p.L * p.l ? best : null;
}

export function packOnce(
  items: any[],
  st: { h: string; s: string },
  sheetL: number,
  sheetW: number,
  allowRot: boolean,
  kerf: number,
  trim: number
): { S: NestingSheet[]; err: any[] } {
  const S: NestingSheet[] = [];
  const err: any[] = [];
  const UW = sheetL - 2 * trim;
  const UH = sheetW - 2 * trim;

  for (const it of items) {
    let best: any = null;
    for (const s of S) {
      for (let i = 0; i < s.free.length; i++) {
        const r = s.free[i];
        for (const rt of allowRot ? [0, 1] : [0]) {
          const w = rt ? it.h : it.w;
          const h = rt ? it.w : it.h;
          if (w <= r.w + 0.01 && h <= r.h + 0.01) {
            const a = r.w - w;
            const b = r.h - h;
            const sc =
              st.h === 'bssf'
                ? Math.min(a, b) * 1e6 + Math.max(a, b)
                : st.h === 'blsf'
                ? Math.max(a, b) * 1e6 + Math.min(a, b)
                : r.w * r.h - w * h;
            if (!best || sc < best.sc) {
              best = { s, i, r, rt, w, h, sc };
            }
          }
        }
      }
    }

    if (!best) {
      const f0 = it.w <= UW && it.h <= UH;
      const f1 = allowRot && it.h <= UW && it.w <= UH;
      if (!f0 && !f1) {
        err.push(it);
        continue;
      }
      const s: NestingSheet = {
        sheetL,
        sheetW,
        free: [{ x: trim, y: trim, w: UW, h: UH }],
        items: [],
      };
      S.push(s);
      const rt = f0 ? 0 : 1;
      best = { s, i: 0, r: s.free[0], rt, w: rt ? it.h : it.w, h: rt ? it.w : it.h };
    }

    const { s, i, r, rt, w, h } = best;
    s.items.push({ it, x: r.x, y: r.y, rt, w, h });
    s.free.splice(i, 1);

    const rw = r.w - w - kerf;
    const rh = r.h - h - kerf;
    const aH = { x: r.x + w + kerf, y: r.y, w: rw, h };
    const bH = { x: r.x, y: r.y + h + kerf, w: r.w, h: rh };
    const aV = { x: r.x + w + kerf, y: r.y, w: rw, h: r.h };
    const bV = { x: r.x, y: r.y + h + kerf, w, h: rh };

    const ar = (a: any, b: any) =>
      Math.max(Math.max(a.w, 0) * Math.max(a.h, 0), Math.max(b.w, 0) * Math.max(b.h, 0));

    let horiz: boolean;
    if (st.s === 'sas') horiz = r.w - w < r.h - h;
    else if (st.s === 'las') horiz = !(r.w - w < r.h - h);
    else if (st.s === 'mina') horiz = ar(aH, bH) <= ar(aV, bV);
    else horiz = ar(aH, bH) > ar(aV, bV);

    const [A, B] = horiz ? [aH, bH] : [aV, bV];
    if (A.w > 5 && A.h > 5) s.free.push(A);
    if (B.w > 5 && B.h > 5) s.free.push(B);
  }

  return { S, err };
}

export function findLargestFreeRect(S: NestingSheet[]) {
  let m = 0;
  let rr: any = null;
  for (const s of S) {
    for (const r of s.free) {
      if (r.w * r.h > m) {
        m = r.w * r.h;
        rr = r;
      }
    }
  }
  return rr;
}

/**
 * Optimizes cutting layout per (panel + thickness + sheet size)
 */
export function computeNesting(
  parts: PartPiece[],
  cf: ModuleConfig,
  triesParam?: number,
  seed: number = 1
): Record<string, NestingGroupResult> {
  const tries = triesParam !== undefined ? triesParam : cf.tries >= 0 ? cf.tries : 120;
  const groups: Record<
    string,
    { parts: PartPiece[]; sheetL: number; sheetW: number; allowRot: boolean }
  > = {};
  const out: Record<string, NestingGroupResult> = {};
  const tr = cf.trim || 0;
  const kerf = cf.k || 3.2;

  parts.forEach((p) => {
    const sL = p.sheetL || cf.SL;
    const sW = p.sheetW || cf.SW;
    const key = `${p.matName || p.mat} — ${R1(p.bt)}mm (${sL}×${sW})`;
    if (!groups[key]) {
      groups[key] = {
        parts: [],
        sheetL: sL,
        sheetW: sW,
        allowRot: p.allowRot !== undefined ? p.allowRot : cf.rot,
      };
    }
    groups[key].parts.push(p);
  });

  const keys = [
    (it: any) => -it.w * it.h,
    (it: any) => -Math.max(it.w, it.h),
    (it: any) => -it.w,
    (it: any) => -it.h,
    (it: any) => -(it.w + it.h),
    (it: any) => -Math.min(it.w, it.h),
  ];

  const strats: { h: string; s: string }[] = [];
  for (const h of ['bssf', 'blsf', 'baf']) {
    for (const sp of ['sas', 'las', 'mina', 'maxa']) {
      strats.push({ h, s: sp });
    }
  }

  for (const gKey in groups) {
    const grp = groups[gKey];
    const UW = grp.sheetL - 2 * tr;
    const UH = grp.sheetW - 2 * tr;
    const fits = (w: number, h: number) =>
      (w <= UW && h <= UH) || (grp.allowRot && h <= UW && w <= UH);

    const raw: any[] = [];
    grp.parts.forEach((p) => {
      p.sheets = [];
      for (let m = 0; m < (p.mult || 1); m++) {
        raw.push({ p, w: p.L, h: p.l });
      }
    });

    const items: any[] = [];
    const bySig: Record<string, any[]> = {};
    let pairs = 0;

    raw.forEach((it) => {
      if (it.p.pl && it.p.pl.length === 4) {
        const sg =
          R(it.p.L) + 'x' + R(it.p.l) + JSON.stringify(it.p.pl.map((a: any) => a.map(R)));
        if (!bySig[sg]) bySig[sg] = [];
        bySig[sg].push(it);
      } else {
        items.push(it);
      }
    });

    for (const sg in bySig) {
      const Ls = bySig[sg];
      const mt = mateTrapezoid(Ls[0].p);
      let i = 0;
      if (mt && fits(mt.Wc, mt.Hc)) {
        for (; i + 1 < Ls.length; i += 2) {
          items.push({
            w: mt.Wc,
            h: mt.Hc,
            p: Ls[i].p,
            comp: [
              { p: Ls[i].p, m: mt.m1 },
              { p: Ls[i + 1].p, m: mt.m2 },
            ],
          });
          pairs++;
        }
      }
      for (; i < Ls.length; i++) {
        items.push(Ls[i]);
      }
    }

    let bestR: any = null;
    let bestSc: any = null;
    let runs = 0;

    const run = (order: any[], st: any) => {
      runs++;
      const r = packOnce(order, st, grp.sheetL, grp.sheetW, grp.allowRot, kerf, tr);
      const largestFree = findLargestFreeRect(r.S);
      const sc = [
        r.err.length,
        r.S.length,
        -(largestFree ? largestFree.w * largestFree.h : 0),
      ];

      if (
        !bestSc ||
        sc[0] < bestSc[0] ||
        (sc[0] === bestSc[0] &&
          (sc[1] < bestSc[1] || (sc[1] === bestSc[1] && sc[2] < bestSc[2])))
      ) {
        bestR = r;
        bestSc = sc;
      }
    };

    if (tries === 0) {
      run([...items].sort((a, b) => b.w * b.h - a.w * a.h), strats[0]);
    } else {
      keys.forEach((kf) => {
        const order = [...items].sort((a, b) => kf(a) - kf(b));
        strats.forEach((st) => run(order, st));
      });

      let sd = seed * 7919 + items.length;
      const rnd = () => {
        sd = (sd * 1103515245 + 12345) & 0x7fffffff;
        return sd / 0x7fffffff;
      };

      for (let t = 0; t < tries; t++) {
        const order = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
        const sw = 1 + Math.floor(rnd() * Math.max(1, order.length / 2));
        for (let q = 0; q < sw; q++) {
          const i = Math.floor(rnd() * order.length);
          const j = Math.floor(rnd() * order.length);
          [order[i], order[j]] = [order[j], order[i]];
        }
        run(order, strats[Math.floor(rnd() * strats.length)]);
      }
    }

    const S = bestR.S;
    let area = 0;
    S.forEach((s: NestingSheet, si: number) =>
      s.items.forEach((e: any) => {
        (e.it.comp || [{ p: e.it.p }]).forEach((pt: any) => {
          if (!pt.p.sheets) pt.p.sheets = [];
          pt.p.sheets.push(`${gKey} · P${si + 1}`);
          area += pt.p.pl ? polyArea(pt.p.pl) : pt.p.L * pt.p.l;
        });
      })
    );

    out[gKey] = {
      S,
      sheetL: grp.sheetL,
      sheetW: grp.sheetW,
      allowRot: grp.allowRot,
      err: bestR.err.map((it: any) => it.p.name),
      errP: bestR.err.map((it: any) => it.p),
      area,
      runs,
      pairs,
      rem: findLargestFreeRect(S),
    };
  }

  return out;
}

import {
  BuiltModuleResult,
  CompartmentNode,
  HardwareItem,
  ModuleConfig,
  PanelRole,
  PartPiece,
  RodItem,
} from '../types/furniture';
import { getPanelById } from '../data/carlier-panels';
import { BLUM_HINGES, BLUM_RUNNERS } from '../data/blum-hardware';
import { LAMELLO_SYSTEMS, validateLamelloConfig } from '../data/lamello-psystem';

export const R = (x: number) => Math.round(x);
export const R1 = (x: number) => Math.round(x * 10) / 10;

export function mkcs(): CompartmentNode {
  return { cs: true, t: 'vide', p: 0 };
}

export function createGrid(cols: number, rows: number): CompartmentNode {
  const row = () =>
    cols > 1 ? { m: true, d: 'v' as const, k: Array.from({ length: cols }, mkcs) } : mkcs();
  return rows > 1 ? { m: true, d: 'h' as const, k: Array.from({ length: rows }, row) } : row();
}

export function getNode(tree: CompartmentNode, path: number[]): CompartmentNode {
  return path.reduce((n, idx) => (n.k && n.k[idx] ? n.k[idx] : n), tree);
}

export function getFastenerPositions(a: number, b: number, mg: number, es: number): number[] {
  const L = b - a;
  const m = Math.min(mg, L / 4);
  const n = Math.max(2, Math.ceil((L - 2 * m) / es) + 1);
  const r: number[] = [];
  for (let i = 0; i < n; i++) {
    r.push(a + m + ((L - 2 * m) * i) / (n - 1));
  }
  return r;
}

export function computeLayout(
  node: CompartmentNode,
  x: number,
  z: number,
  w: number,
  h: number,
  path: number[],
  cf: ModuleConfig,
  warnings: string[]
) {
  node.r = { x, z, w, h };
  node.pt = path;

  if (node.cs) {
    const t = cf.t;
    node.i = { x: x + t, z: z + t, w: w - 2 * t, h: h - 2 * t };
    x += t;
    z += t;
    w -= 2 * t;
    h -= 2 * t;
  }

  if (!node.k || node.k.length === 0) return;

  const gap = node.m ? 0 : cf.tInt;
  const V = node.d === 'v';
  const K = node.k.length;
  const av = (V ? w : h) - (K - 1) * gap;

  const fixed = node.k.map((q) => q.s || 0);
  const notFixedCount = fixed.filter((s) => !s).length;
  const sumFixed = fixed.reduce((a, b) => a + b, 0);

  const sizes = fixed.map((s) => R1(s || (av - sumFixed) / Math.max(notFixedCount, 1)));
  sizes[K - 1] = R1(av - sizes.slice(0, K - 1).reduce((a, b) => a + b, 0));

  if (sizes.some((s) => s <= 0)) {
    warnings.push('Dimensions incohérentes : une case a une largeur ou hauteur nulle ou négative.');
  }

  let current = V ? x : z + h;
  node.k.forEach((child, i) => {
    const s = sizes[i];
    if (V) {
      computeLayout(child, current, z, s, h, path.concat(i), cf, warnings);
      current = R1(current + s + gap);
    } else {
      computeLayout(child, x, R1(current - s), w, s, path.concat(i), cf, warnings);
      current = R1(current - s - gap);
    }
  });
}

function assignHoles(
  parts: PartPiece[],
  axis: number,
  coord: [number, number, number],
  kind: 't' | 'l',
  connectorId: string,
  allJointCoords: [number, number, number][]
) {
  allJointCoords.push(coord);
  const isScrew = connectorId === 'confirmat_7x50' && kind === 't';
  const lamelloSpec = LAMELLO_SYSTEMS[connectorId as keyof typeof LAMELLO_SYSTEMS];
  const grooveDepth = lamelloSpec ? lamelloSpec.grooveDepthMm : 14;

  for (const p of parts) {
    if (p.til) {
      const T = p.til;
      if (coord[1] < T.y0 - 0.01 || coord[1] > T.y1 + 0.01) continue;
      const v = coord[1] - T.y0;
      if (axis === 2) {
        if (coord[0] >= T.x0 - 0.01 && coord[0] <= T.x1 + 0.01) {
          const zl = T.za + (coord[0] - T.x0) * T.tn;
          const zu = zl + p.th / T.cs;
          if (Math.min(Math.abs(coord[2] - zl), Math.abs(coord[2] - zu)) < 3) {
            p.h.push(
              isScrew
                ? { k: 'f', u: (coord[0] - T.x0) / T.cs, v, d: 5 }
                : {
                    k: 'q',
                    u: (coord[0] - T.x0) / T.cs,
                    v,
                    a: 'v',
                    depth: grooveDepth,
                    connector: connectorId,
                  }
            );
          }
        }
      } else {
        const w = axis === -1 ? 0.6 * p.th : 0.5;
        const e =
          Math.abs(coord[0] - T.x0) < w ? 'g' : Math.abs(coord[0] - T.x1) < w ? 'd' : null;
        if (e) {
          const zl = T.za + (coord[0] - T.x0) * T.tn;
          if (coord[2] >= zl - 0.5 && coord[2] <= zl + p.th / T.cs + 0.5) {
            p.h.push({
              k: isScrew ? 'v' : 'p',
              e,
              pos: v,
              depth: grooveDepth,
              connector: connectorId,
            });
          }
        }
      }
      continue;
    }

    if (
      p.a < 0 ||
      ![0, 1, 2].every(
        (i) => coord[i] >= p.min[i] - 0.01 && coord[i] <= p.min[i] + p.size[i] + 0.01
      )
    ) {
      continue;
    }

    const u = coord[p.ua] - p.min[p.ua];
    const v = coord[p.va] - p.min[p.va];

    if (kind === 't' && axis === p.a) {
      p.h.push(
        isScrew
          ? { k: 'f', u, v, d: 5 }
          : {
              k: 'q',
              u,
              v,
              a: p.ua === 1 ? 'u' : 'v',
              depth: grooveDepth,
              connector: connectorId,
            }
      );
    } else {
      const d = [u, p.L - u, v, p.l - v];
      const i = d.indexOf(Math.min(...d));
      const edge = (['g', 'd', 'h', 'b'] as const)[i];
      p.h.push({
        k: isScrew ? 'v' : 'p',
        e: edge,
        pos: i < 2 ? v : u,
        depth: grooveDepth,
        connector: connectorId,
      });
    }
  }
}

/**
 * Builds all 3D parts and machining details with per-role Carlier panels, Blum hardware, & Lamello P-System
 */
export function buildModule(cf: ModuleConfig, tree: CompartmentNode): BuiltModuleResult {
  const {
    W,
    Dg,
    Dd,
    t,
    tInt,
    tP,
    tTr,
    j,
    b,
    tb,
    trap,
    fL,
    fR,
    fW,
    hasPlinth,
    plinthHeight,
    roles,
  } = cf;

  const Hg = cf.H;
  const Hd = cf.Hd || cf.H;
  const Hm = Math.max(Hg, Hd);
  const Dm = Math.max(Dg, Dd);

  const Pm: PartPiece[] = [];
  const HW: HardwareItem[] = [];
  const ROD: RodItem[] = [];
  const warnings: string[] = [];
  const jointCoordsCorps: [number, number, number][] = [];
  const jointCoordsInt: [number, number, number][] = [];

  const lamelloValidation = validateLamelloConfig(cf);
  lamelloValidation.forEach((v) => {
    if (v.level === 'error') warnings.push(`${v.title} : ${v.detail}`);
  });

  const hinge = BLUM_HINGES[cf.hingeId] || BLUM_HINGES['71B3550'];
  const runner = BLUM_RUNNERS[cf.runnerId] || BLUM_RUNNERS.MOVENTO_BLUMOTION;
  const corpsConnector = LAMELLO_SYSTEMS[cf.fx] || LAMELLO_SYSTEMS.clamex_p14;

  const sloped = Math.abs(Hg - Hd) > 0.5;
  const obT = cf.obH !== 'bas';
  const av = trap && cf.obq === 'avant' && Math.abs(Dg - Dd) > 0.5;

  const dep = (x: number) => Dg + ((Dd - Dg) * x) / W;
  const hh = (x: number) => Hg + ((Hd - Hg) * x) / W;

  const bevel = Math.round((Math.abs(Math.atan((Hd - Hg) / W)) * 1800) / Math.PI) / 10;

  computeLayout(tree, 0, 0, W, Hm, [], cf, warnings);

  const csList: CompartmentNode[] = [];
  (function findCs(n: CompartmentNode) {
    if (n.cs) csList.push(n);
    else if (n.k) n.k.forEach(findCs);
  })(tree);

  if (sloped && av) {
    warnings.push('Pente en hauteur et profondeur oblique combinées : vérifier les coupes.');
  }

  // Helper to resolve Carlier panel visuals & sheet specs for any role
  const getRoleProps = (role: PanelRole, thicknessOverride?: number) => {
    const rConf = roles[role];
    const panel = getPanelById(rConf.panelId);
    return {
      role,
      mat: panel.id,
      matName: `${panel.name} (${panel.code})`,
      colorHex: panel.colorHex,
      woodGrain: panel.grain,
      roughness: panel.roughness,
      metalness: panel.metalness,
      sheetL: rConf.sheetL,
      sheetW: rConf.sheetW,
      allowRot: rConf.allowRot,
      bt: thicknessOverride ?? rConf.thickness,
      mult: rConf.doubled ? 2 : 1,
    };
  };

  const corpsO = getRoleProps('corps');
  const intO = getRoleProps('interieur');
  const facO = getRoleProps('facades');
  const fondO = getRoleProps('fond');
  const tirO = getRoleProps('tiroirs');

  const add = (
    name: string,
    roleProps: ReturnType<typeof getRoleProps>,
    min: [number, number, number],
    size: [number, number, number],
    f?: string,
    cut?: string,
    note?: string,
    o?: any
  ): PartPiece => {
    o = o || {};
    const a = size.indexOf(Math.min(...size));
    const ax = [0, 1, 2].filter((i) => i !== a).sort((x, y) => size[y] - size[x]);
    const q: PartPiece = {
      name,
      role: roleProps.role,
      min,
      size,
      f: f || '',
      cut: cut || '90°',
      note: note || '',
      h: [],
      a,
      ua: ax[0],
      va: ax[1],
      L: size[ax[0]],
      l: size[ax[1]],
      t: size[a],
      th: o.th || size[a],
      bt: o.bt ?? roleProps.bt,
      mult: o.mult ?? roleProps.mult,
      mat: roleProps.mat,
      matName: roleProps.matName,
      colorHex: o.colorHex || roleProps.colorHex,
      woodGrain: o.woodGrain !== undefined ? o.woodGrain : roleProps.woodGrain,
      roughness: o.roughness !== undefined ? o.roughness : roleProps.roughness,
      metalness: o.metalness !== undefined ? o.metalness : roleProps.metalness,
      sheetL: roleProps.sheetL,
      sheetW: roleProps.sheetW,
      allowRot: roleProps.allowRot,
      poly: o.poly || null,
      obl: null,
      til: null,
    };

    if (o.L) {
      q.L = o.L;
      q.l = o.l;
      q.a = -1;
      q.t = o.bt ?? roleProps.bt;
      if (o.pl) q.pl = o.pl;
    }
    if (q.poly) {
      q.pl = q.poly.map((pt) => [pt[q.ua] - min[q.ua], pt[q.va] - min[q.va]]);
    }
    Pm.push(q);
    return q;
  };

  const vp = (
    nm: string,
    roleProps: ReturnType<typeof getRoleProps>,
    x0: number,
    x1: number,
    zb: (x: number) => number,
    zt: (x: number) => number,
    yf: (x: number) => number,
    th: number,
    note?: string,
    o?: any
  ): PartPiece => {
    o = { ...(o || {}), th };
    const zlo = Math.min(zb(x0), zb(x1));
    const zhi = Math.max(zt(x0), zt(x1));
    const Hh = zhi - zlo;
    const dy = yf(x1) - yf(x0);
    const vs = Math.abs(zb(x1) - zb(x0)) > 0.5 || Math.abs(zt(x1) - zt(x0)) > 0.5;

    if (Math.abs(dy) < 0.5) {
      const y0 = yf(x0);
      const q = add(
        nm,
        roleProps,
        [x0, y0, zlo],
        [x1 - x0, th, Hh],
        '',
        '90°',
        note,
        {
          ...o,
          poly: vs
            ? [
                [x0, y0, zb(x0)],
                [x1, y0, zb(x1)],
                [x1, y0, zt(x1)],
                [x0, y0, zt(x0)],
              ]
            : null,
        }
      );
      q.W2 = x1 - x0;
      q.pt = (wx, hz) => (q.ua === 2 ? { u: Hh - hz, v: wx } : { u: wx, v: Hh - hz });
      return q;
    }

    const len = Math.hypot(x1 - x0, dy);
    const ang = Math.atan2(dy, x1 - x0);
    const sw = Hh > len;
    const pts: [number, number][] = [
      [0, zhi - zb(x0)],
      [len, zhi - zb(x1)],
      [len, zhi - zt(x1)],
      [0, zhi - zt(x0)],
    ];
    const q = add(
      nm,
      roleProps,
      [x0, Math.min(yf(x0), yf(x1)), zlo],
      [x1 - x0, Math.abs(dy) + th, Hh],
      '',
      '90°',
      note,
      {
        ...o,
        L: Math.max(len, Hh),
        l: Math.min(len, Hh),
        pl: pts.map((a) => (sw ? [a[1], a[0]] : a)),
      }
    );
    q.obl = { ang, x0, y0: yf(x0), zhi, th, pts };
    q.W2 = len;
    q.pt = (wx, hz) => (sw ? { u: hz, v: wx } : { u: wx, v: hz });
    return q;
  };

  csList.forEach((n, ci) => {
    const pre = csList.length > 1 ? `C${ci + 1} · ` : '';
    const { x: ox, z: oz, w: Wc, h: Hc } = n.r!;
    const iw = Wc - 2 * t;

    const dL = dep(ox);
    const dR = dep(ox + Wc);
    const dm = Math.min(dL, dR);

    const FY = (x: number) => (av ? Dm - dep(x) : 0);
    const BY = (x: number) => (av ? Dm : trap ? dep(x) : dm);

    const tc = sloped && obT && oz + Hc >= Hm - 0.01;
    const bc = sloped && !obT && oz <= 0.01;
    const ZT = (x: number) => (tc ? hh(x) : oz + Hc);
    const ZB = (x: number) => (bc ? Hm - hh(x) : oz);

    if (
      Math.min(ZT(ox), ZT(ox + Wc)) - Math.max(ZB(ox), ZB(ox + Wc)) < 2 * t + 20 ||
      Wc < 2 * t + 20
    ) {
      warnings.push('Un caisson est trop réduit pour recevoir des panneaux.');
      return;
    }

    const side = (
      nm: string,
      x: number,
      xs: number,
      dsb: number,
      full: boolean,
      ct?: string
    ) => {
      const y0 = FY(xs);
      const y1 = av ? Dm : dsb;
      const zb = ZB(xs) + (full ? 0 : t);
      const zt = ZT(xs) - (full ? 0 : t);
      const bv = tc || bc;
      add(
        pre + nm,
        corpsO,
        [x, y0, zb],
        [t, y1 - y0, zt - zb],
        full ? '' : `H − 2×${t} = ${R(zt - zb)}`,
        ct || (bv ? `biseau ${bevel}°` : '90°'),
        `Profondeur ${R(y1 - y0)} mm${
          bv ? ` · biseau de ${bevel}° chant ${tc ? 'haut' : 'bas'}` : ''
        }`
      );
    };

    const hp = (nm: string, x0: number, x1: number, z: number, cut?: string, f?: string) => {
      const fa = FY(x0);
      const fb = FY(x1);
      const ba = BY(x0);
      const bb = BY(x1);
      const y0 = Math.min(fa, fb);
      const y1 = Math.max(ba, bb);
      const sk = trap && (Math.abs(fa - fb) > 0.5 || Math.abs(ba - bb) > 0.5);

      return add(
        pre + nm,
        corpsO,
        [x0, y0, z],
        [x1 - x0, y1 - y0, t],
        f,
        cut || '90°',
        sk
          ? `Trapèze : profondeur ${R(ba - fa)} → ${R(bb - fb)} mm`
          : `Rectangulaire, prof. ${R(y1 - y0)} mm`,
        {
          poly: sk
            ? [
                [x0, fa],
                [x1, fb],
                [x1, bb],
                [x0, ba],
              ]
            : null,
          v:
            cut === '45°' && !sk
              ? { min: [x0 + t, y0, z], size: [x1 - x0 - 2 * t, y1 - y0, t] }
              : null,
        }
      );
    };

    const til = (
      nm: string,
      x0: number,
      x1: number,
      top: boolean,
      cut?: string,
      f?: string
    ) => {
      const zf = top ? ZT : ZB;
      const ang = Math.atan2(zf(x1) - zf(x0), x1 - x0);
      const cs2 = Math.cos(ang);
      const tn = Math.tan(ang);
      const len = (x1 - x0) / cs2;
      const za = top ? zf(x0) - t / cs2 : zf(x0);
      const ya = Math.min(FY(x0), FY(x1));
      const yb = Math.max(BY(x0), BY(x1));
      const zA = za;
      const zB = za + (x1 - x0) * tn;
      const zmin = Math.min(zA, zB);
      const zmax = Math.max(zA, zB) + t / cs2;
      const pl: [number, number][] = [
        [0, FY(x0) - ya],
        [len, FY(x1) - ya],
        [len, BY(x1) - ya],
        [0, BY(x0) - ya],
      ];

      const q = add(
        pre + nm,
        corpsO,
        [x0, ya, zmin],
        [x1 - x0, yb - ya, zmax - zmin],
        f,
        cut || `bouts à ${bevel}°`,
        `Panneau incliné de ${bevel}° (longueur ${R(len)} mm)`,
        { th: t, L: len, l: yb - ya, pl }
      );
      q.til = { x0, x1, y0: ya, y1: yb, za, tn, cs: cs2, ang };
      return q;
    };

    const bot = (x0: number, x1: number, cut?: string, f?: string) =>
      bc ? til('Dessous', x0, x1, false, cut, f) : hp('Dessous', x0, x1, oz, cut, f);

    const top = (x0: number, x1: number, cut?: string, f?: string) =>
      tc
        ? til('Dessus', x0, x1, true, cut, f)
        : hp('Dessus', x0, x1, oz + Hc - t, cut, f);

    // Corps joinery
    if (j === 'A') {
      side('Côté gauche', ox, ox + t / 2, dL, false);
      side('Côté droit', ox + Wc - t, ox + Wc - t / 2, dR, false);
      bot(ox, ox + Wc);
      top(ox, ox + Wc);

      for (const x of [ox + t / 2, ox + Wc - t / 2]) {
        for (const y of getFastenerPositions(FY(x), BY(x), cf.mg, cf.es)) {
          for (const z of [ZB(x) + t, ZT(x) - t]) {
            assignHoles(Pm, 2, [x, y, z], 't', cf.fx, jointCoordsCorps);
          }
        }
      }
    } else if (j === 'B') {
      side('Côté gauche', ox, ox + t / 2, dL, true);
      side('Côté droit', ox + Wc - t, ox + Wc - t / 2, dR, true);
      bot(ox + t, ox + Wc - t, '90°', `L − 2×${t} = ${R(iw)}`);
      top(ox + t, ox + Wc - t, '90°', `L − 2×${t} = ${R(iw)}`);

      for (const x of [ox + t, ox + Wc - t]) {
        for (const y of getFastenerPositions(FY(x), BY(x), cf.mg, cf.es)) {
          for (const z of [ZB(x) + t / 2, ZT(x) - t / 2]) {
            assignHoles(Pm, 0, [x, y, z], 't', cf.fx, jointCoordsCorps);
          }
        }
      }
    } else {
      side('Côté gauche', ox, ox + t / 2, dL, true, '45°');
      side('Côté droit', ox + Wc - t, ox + Wc - t / 2, dR, true, '45°');
      bot(ox, ox + Wc, '45°');
      top(ox, ox + Wc, '45°');

      for (const x of [ox + t / 2, ox + Wc - t / 2]) {
        for (const y of getFastenerPositions(FY(x), BY(x), cf.mg, cf.es)) {
          for (const z of [ZB(x) + t / 2, ZT(x) - t / 2]) {
            assignHoles(Pm, -1, [x, y, z], 'l', cf.fx, jointCoordsCorps);
          }
        }
      }
    }

    if (hasPlinth && plinthHeight > 0) {
      add(
        pre + 'Plinthe socle avant',
        corpsO,
        [ox, FY(ox) + cf.plinthSetback, oz - plinthHeight],
        [Wc, t, plinthHeight],
        `L = ${R(Wc)}`,
        '90°',
        `Plinthe décorative h=${plinthHeight}mm`
      );
    }

    // Fond arrière (panneau indépendant rôle 'fond')
    if (b === 'A' || b === 'R') {
      const ob = !av && trap && Math.abs(dR - dL) > 0.5;
      const yf = ob ? dep : () => (av ? Dm : dm);
      vp(
        pre + 'Fond',
        fondO,
        ox,
        ox + Wc,
        ZB,
        ZT,
        yf,
        tb,
        b === 'R'
          ? `Fond ${tb} mm monté en rainure arrière`
          : `Fond ${tb} mm appliqué en feuillure arrière`
      );
    }

    // Drawer Builder (Blum MOVENTO / TANDEM / LEGRABOX / MERIVOBOX)
    const buildDrawer = (r: { x: number; z: number; w: number; h: number }) => {
      const mk0 = Pm.length;
      const xa = r.x;
      const xb = r.x + r.w;
      const zbase = Math.max(r.z, ZB(xa) + t, ZB(xb) + t);
      const ztop = Math.min(r.z + r.h, ZT(xa) - t, ZT(xb) - t);

      // Compute drawer internal clearances from selected Blum runner + jlat/jvd
      const bw = r.w - 2 * cf.jlat;
      const bh = Math.max(60, ztop - zbase - 2 * cf.jvd);
      const y0 = Math.max(FY(xa), FY(xb)) + tP;
      const ymax = Math.min(BY(xa), BY(xb)) - 15;

      // Snap nominal length NL to closest supported Blum runner length
      const maxAvailableDepth = ymax - y0;
      const supportedNL = runner.nominalLengthsMm.filter((nl) => nl <= maxAvailableDepth);
      const bd =
        supportedNL.length > 0
          ? supportedNL[supportedNL.length - 1]
          : runner.nominalLengthsMm[0];

      const x = r.x + cf.jlat;
      const z = zbase + cf.jvd;

      if (bw < 100 || bh < 50) {
        warnings.push(`Case trop exigüe pour un tiroir (${R(r.w)} × ${R(r.h)} mm).`);
        return;
      }

      if (!runner.isMetalBox && tTr > runner.maxDrawerSideThicknessMm) {
        warnings.push(
          `Coulisse ${runner.series} : épaisseur côté tiroir max ${runner.maxDrawerSideThicknessMm} mm (actuel : ${tTr} mm).`
        );
      }

      // Façade tiroir (utilise panneau rôle 'facades')
      const fg = cf.jg;
      vp(
        pre + 'Façade tiroir',
        facO,
        xa + fg / 2,
        xb - fg / 2,
        (u) => Math.max(r.z + fg / 2, ZB(u) + t + fg / 2),
        (u) => Math.min(r.z + r.h - fg / 2, ZT(u) - t - fg / 2),
        FY,
        tP,
        `Jeu façade ${fg} mm · ${runner.name}`
      );

      if (runner.isMetalBox) {
        // LEGRABOX / MERIVOBOX : parois métal fournies par Blum, on débite fond et dos bois (16mm)
        const boxW = r.w - 2 * cf.jlat;
        const backH = Math.min(bh, 177); // Hauteur M/K standard Legrabox
        add(
          pre + `Dos tiroir ${runner.series}`,
          tirO,
          [x, y0 + bd - 16, z + 10],
          [boxW, 16, backH],
          `LW − ${2 * cf.jlat} = ${R(boxW)}`,
          '90°',
          `Dos bois 16 mm pour ${runner.name}`
        );
        add(
          pre + `Fond tiroir ${runner.series}`,
          tirO,
          [x, y0, z],
          [boxW, bd - 10, 16],
          `LW − ${2 * cf.jlat} = ${R(boxW)}`,
          '90°',
          `Fond bois 16 mm pour parois métal ${runner.series}`
        );

        // Représentation visuelle 3D des deux parois métal Blum (non comptabilisées au débit bois mais visibles en 3D)
        // Ajoutées directement au BOM Blum !
        HW.push({
          k: `Kit tiroir complet ${runner.name} NL ${bd} mm (parois métal + coulisses + attaches)`,
          q: 1,
          ref: `${runner.refBase}.${bd}`,
          category: 'runners',
        });
      } else {
        // Tiroir bois traditionnel sur MOVENTO / TANDEM / Billes
        const cn = `${runner.name} NL ${bd} mm. Jeu latéral ${cf.jlat} mm/côté.`;
        add(pre + 'Côté tiroir G', tirO, [x, y0, z], [tTr, bd, bh], 'NL ' + bd, '90°', cn);
        add(
          pre + 'Côté tiroir D',
          tirO,
          [x + bw - tTr, y0, z],
          [tTr, bd, bh],
          'NL ' + bd,
          '90°',
          cn
        );
        add(
          pre + 'Arrière tiroir',
          tirO,
          [x + tTr, y0 + bd - tTr, z],
          [bw - 2 * tTr, tTr, bh - 15],
          `L − 2×${tTr} = ${R(bw - 2 * tTr)}`,
          '90°',
          ''
        );
        const drawerFondT = fondO.bt || 8;
        add(
          pre + 'Fond tiroir',
          { ...fondO, bt: drawerFondT },
          [x + tTr - 5, y0, z + drawerFondT],
          [bw - 2 * tTr + 10, bd - tTr + 5, drawerFondT],
          `L + 2×5 (rainures) = ${R(bw - 2 * tTr + 10)}`,
          '90°',
          `Fond ${drawerFondT} mm engagé en rainure (${fondO.matName}).`,
          { bt: drawerFondT }
        );

        HW.push({
          k: `${runner.name} NL ${bd} mm (la paire + verrouillages)`,
          q: 1,
          ref: `${runner.refBase}${bd}`,
          category: 'runners',
        });
      }

      if (runner.motionTechnology === 'TIP-ON BLUMOTION') {
        HW.push({
          k: 'Synchronisation & Unité TIP-ON BLUMOTION Blum',
          q: 1,
          ref: 'T60L7x40',
          category: 'runners',
        });
      } else {
        HW.push({
          k: 'Poignée de tiroir ou profil prise de main',
          q: 1,
          category: 'handles',
        });
      }

      for (let i = mk0; i < Pm.length; i++) {
        Pm[i].dwr = { d: bd * 0.75 };
      }
    };

    // Door Builder (Blum CLIP top BLUMOTION / 155° / Portes épaisses / TIP-ON)
    const buildDoor = (q: CompartmentNode, r: { x: number; z: number; w: number; h: number }) => {
      const k = q.p || 1;
      const ov = q.pm === 'ov';
      const jg = cf.jg >= 0 ? cf.jg : hinge.recommendedDoorGapMm;
      const cupOffset = cf.hingeCupOffset || hinge.cupEdgeOffsetMm;

      if (tP > hinge.maxDoorThicknessMm) {
        warnings.push(
          `Porte de ${tP} mm > max ${hinge.maxDoorThicknessMm} mm pour ${hinge.ref}. Sélectionnez la charnière 71B9550 (portes épaisses).`
        );
      }

      const doorList: { q: CompartmentNode; r: { x: number; z: number; w: number; h: number } }[] =
        [];
      (function walk(z: CompartmentNode) {
        if (z.p) doorList.push({ q: z, r: z.cs ? z.i! : z.r! });
        if (z.k) z.k.forEach(walk);
      })(n);

      const ii = n.i!;
      const ol = r.x - ii.x < 0.6;
      const orr = ii.x + ii.w - (r.x + r.w) < 0.6;
      const ob = r.z - ii.z < 0.6;
      const ot = ii.z + ii.h - (r.z + r.h) < 0.6;

      const vo = (a: any, b: any) =>
        Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z) > 10;
      const ho = (a: any, b: any) =>
        Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 10;

      const hasNeighbour = (s: 'L' | 'R' | 'B' | 'T') =>
        doorList.some(
          (D) =>
            D.q !== q &&
            D.q.pm === 'ov' &&
            (s === 'L'
              ? Math.abs(D.r.x + D.r.w + tInt - r.x) < 0.6 && vo(D.r, r)
              : s === 'R'
              ? Math.abs(r.x + r.w + tInt - D.r.x) < 0.6 && vo(D.r, r)
              : s === 'B'
              ? Math.abs(D.r.z + D.r.h + tInt - r.z) < 0.6 && ho(D.r, r)
              : Math.abs(r.z + r.h + tInt - D.r.z) < 0.6 && ho(D.r, r))
        );

      let xL: number;
      let xR: number;
      let zb: (u: number) => number;
      let zt: (u: number) => number;

      if (ov) {
        xL = ol ? r.x : hasNeighbour('L') ? r.x - tInt / 2 + jg / 2 : r.x - tInt;
        xR = orr
          ? r.x + r.w
          : hasNeighbour('R')
          ? r.x + r.w + tInt / 2 - jg / 2
          : r.x + r.w + tInt;
        zb = ob
          ? (u) => ZB(u) + jg / 2
          : hasNeighbour('B')
          ? () => r.z - tInt / 2 + jg / 2
          : () => r.z - tInt;
        zt = ot
          ? (u) => ZT(u) - jg / 2
          : hasNeighbour('T')
          ? () => r.z + r.h + tInt / 2 - jg / 2
          : () => r.z + r.h + tInt;
      } else {
        xL = r.x + jg;
        xR = r.x + r.w - jg;
        zb = (u) => Math.max(r.z + jg, ZB(u) + t + jg);
        zt = (u) => Math.min(r.z + r.h - jg, ZT(u) - t - jg);
      }

      const ww = (xR - xL - (k - 1) * jg) / k;
      const yf = ov ? (u: number) => FY(u) - tP : FY;

      for (let i = 0; i < k; i++) {
        const xa = R1(xL + i * (ww + jg));
        const xb = R1(xa + ww);
        if (Math.min(zt(xa) - zb(xa), zt(xb) - zb(xb)) < 180) {
          warnings.push('Case trop basse pour une porte de meuble.');
          return;
        }

        const Hh = Math.max(zt(xa), zt(xb)) - Math.min(zb(xa), zb(xb));
        const nh = Math.max(2, Math.ceil((Hh - 400) / 700) + 1);
        const e0 = Math.min(150, Hh / 5);

        const d = vp(
          pre + (k === 1 ? 'Porte' : i ? 'Porte droite' : 'Porte gauche'),
          facO,
          xa,
          xb,
          zb,
          zt,
          yf,
          tP,
          `${ov ? 'Recouvrement' : 'Rentrante'} · Jeu ${jg} mm · ${hinge.name} : ${nh} cuvettes Ø35 à ${cupOffset} mm du chant.`
        );

        d.dr = {
          h: k === 2 && i === 1 ? 'R' : 'L',
          px: k === 2 && i === 1 ? xb : xa,
          pz: yf(k === 2 && i === 1 ? xb : xa) + tP / 2,
        };

        for (let e = 0; e < nh; e++) {
          const hz = e0 + (e * (Hh - 2 * e0)) / (nh - 1);
          const wx = k === 2 && i === 1 ? d.W2! - cupOffset : cupOffset;
          d.h.push({ k: 'f', ...d.pt!(wx, hz), d: 35 });
        }

        HW.push({
          k: `${hinge.name} (${ov ? 'recouvrement' : 'rentrante'})`,
          q: nh,
          ref: hinge.ref,
          category: 'hinges',
        });
        HW.push({
          k: `Embase droite/cruciforme Blum EXPANDO 0 mm (${hinge.finish})`,
          q: nh,
          ref: '177H3100E',
          category: 'hinges',
        });

        if (hinge.tipOnRequired) {
          HW.push({
            k: 'Loqueteau magnétique Blum TIP-ON version longue + pastille',
            q: 1,
            ref: '956A1004',
            category: 'handles',
          });
        } else {
          HW.push({
            k: 'Poignée ou bouton de porte',
            q: 1,
            category: 'handles',
          });
        }
      }
    };

    const buildRod = (
      r: { x: number; z: number; w: number; h: number },
      q: CompartmentNode
    ) => {
      const d = q.rd || 25;
      const hd = q.rh !== undefined ? q.rh : 50;
      const xa = r.x;
      const xb = r.x + r.w;
      const ztop = Math.min(r.z + r.h, ZT(xa) - t, ZT(xb) - t);
      const zax = ztop - hd - d / 2;
      const L = R1(r.w - 4);

      if (zax < Math.max(r.z, ZB(xa) + t, ZB(xb) + t) + d) {
        warnings.push('Tringle de penderie trop basse ou case trop petite.');
        return;
      }

      const ym = (Math.max(FY(xa), FY(xb)) + 20 + Math.min(BY(xa), BY(xb))) / 2;
      const ns = Math.max(0, Math.ceil(L / 1000) - 1);

      ROD.push({ x0: xa + 2, x1: xb - 2, y: ym, z: zax, d });
      HW.push({
        k: `Tube penderie ovale / rond Ø${d} mm chromé (L=${L}mm)`,
        q: 1,
        L,
        category: 'rods',
      });
      HW.push({
        k: `Supports de tringle d'extrémité Ø${d} mm`,
        q: 2 + ns,
        category: 'rods',
      });
    };

    // Internal partitions and shelves (panneaux rôle 'interieur' + quincaillerie Lamello P-System ou Taquets)
    const buildInterior = (q: CompartmentNode) => {
      const r = q.cs ? q.i! : q.r!;
      if (q.k) {
        q.k.forEach(buildInterior);
        for (let i = 0; i < q.k.length - 1; i++) {
          const a = q.k[i].r!;
          if (q.d === 'v') {
            const x = a.x + a.w;
            const xc = x + tInt / 2;
            const y0 = FY(xc) + 20;
            const y1 = BY(xc);
            const zlo = Math.max(r.z, ZB(xc) + t);
            const zhi = Math.min(r.z + r.h, ZT(xc) - t);

            if (zhi - zlo < 30 || y1 - y0 < 30) {
              warnings.push('Une cloison dépasse du caisson (plan sous-pente).');
            } else {
              add(
                pre + 'Cloison verticale',
                intO,
                [x, y0, zlo],
                [tInt, y1 - y0, zhi - zlo],
                `H = ${R(zhi - zlo)}`,
                '90°',
                `Profondeur ${R(y1 - y0)} mm`
              );

              const intConn = cf.fxInt === 'taquets_5mm' ? cf.fx : cf.fxInt;
              for (const z of [zlo, zhi]) {
                for (const y of getFastenerPositions(y0, y1, cf.mg, cf.es)) {
                  assignHoles(Pm, 2, [xc, y, z], 't', intConn, jointCoordsInt);
                }
              }
            }
          } else {
            const z = a.z - tInt;
            const xl = r.x;
            const xr = r.x + r.w;
            const fl = FY(xl) + 20;
            const fr = FY(xr) + 20;
            const bl = BY(xl);
            const br = BY(xr);
            const sk = trap && (Math.abs(fl - fr) > 0.5 || Math.abs(bl - br) > 0.5);
            const y0 = Math.min(fl, fr);
            const y1 = Math.max(bl, br);

            if (
              z < ZB(xl) + t - 0.5 ||
              z < ZB(xr) + t - 0.5 ||
              z + tInt > ZT(xl) - t + 0.5 ||
              z + tInt > ZT(xr) - t + 0.5
            ) {
              warnings.push('Une étagère traverse le plan oblique.');
            }

            add(
              pre + 'Étagère horizontale',
              intO,
              [xl, y0, z],
              [r.w, y1 - y0, tInt],
              `L = ${R(r.w)}`,
              '90°',
              sk
                ? `Trapèze : prof. ${R(bl - fl)} → ${R(br - fr)} mm`
                : 'Étagère rectangulaire',
              {
                poly: sk
                  ? [
                      [xl, fl],
                      [xr, fr],
                      [xr, br],
                      [xl, bl],
                    ]
                  : null,
              }
            );

            if (cf.fxInt === 'taquets_5mm') {
              HW.push({
                k: 'Taquets d’étagère métalliques Ø5 mm avec ergot anti-basculement',
                q: 4,
                category: 'connectors',
              });
            } else {
              for (const [xCoord, fyCoord, byCoord] of [
                [xl, fl, bl],
                [xr, fr, br],
              ]) {
                for (const y of getFastenerPositions(fyCoord, byCoord, cf.mg, cf.es)) {
                  assignHoles(Pm, 0, [xCoord, y, z + tInt / 2], 't', cf.fxInt, jointCoordsInt);
                }
              }
            }
          }
        }
      } else if (q.t === 'tiroir') {
        buildDrawer(r);
      } else if (q.t === 'tringle') {
        buildRod(r, q);
      }

      if (q.p) {
        buildDoor(q, r);
      }
    };

    buildInterior(n);
  });

  // Fillers (Fileurs d'ajustement - panneau rôle 'facades')
  const zbm = (x: number) => (sloped && !obT ? Hm - hh(x) : 0);
  const ztm = (x: number) => (sloped && obT ? hh(x) : Hm);
  const hasOverlay = (q: CompartmentNode): boolean =>
    ((q.p || 0) > 0 && q.pm === 'ov') || (q.k ? q.k.some(hasOverlay) : false);
  const ovAny = hasOverlay(tree);
  const FYm = (x: number) => (av ? Dm - dep(x) : 0);

  const fp = (nm: string, x0: number, x1: number, xe: number) => {
    const zl = zbm(xe);
    const zh = ztm(xe);
    const q = vp(
      nm,
      facO,
      x0,
      x1,
      () => zl,
      () => zh,
      (u) => FYm(u) - (ovAny ? tP : 0),
      tP,
      `Aligné sur façades${ovAny ? ' (recouvrement)' : ''}`
    );
    q.f = `Fileur ${fW} × ${R(zh - zl)}`;
    return q;
  };

  if (fL && fW > 0) fp('Fileur gauche', -fW, 0, 0);
  if (fR && fW > 0) fp('Fileur droit', W, W + fW, W);

  cf.fy0 = ovAny ? -tP : 0;

  // Add Lamello / Fasteners BOM
  const njCorps = jointCoordsCorps.length;
  if (njCorps > 0) {
    HW.push({
      k: corpsConnector.bomLabel,
      q: njCorps,
      category: cf.fx === 'confirmat_7x50' ? 'screws' : 'connectors',
    });
  }

  const njInt = jointCoordsInt.length;
  if (njInt > 0 && cf.fxInt !== 'taquets_5mm') {
    const intSpec = LAMELLO_SYSTEMS[cf.fxInt];
    HW.push({
      k: intSpec.bomLabel,
      q: njInt,
      category: cf.fxInt === 'confirmat_7x50' ? 'screws' : 'connectors',
    });
  }

  return {
    P: Pm,
    nj: njCorps,
    njInt,
    cf,
    hw: HW,
    rods: ROD,
    warnings,
    lamelloValidation,
  };
}

export function getPlacementTransform(
  cf: ModuleConfig,
  rot: 0 | 90 | 180 | 270,
  x: number,
  z: number
) {
  const th = (rot * Math.PI) / 180;
  const co = Math.round(Math.cos(th));
  const si = Math.round(Math.sin(th));
  const x0 = cf.fL ? -cf.fW : 0;
  const x1 = cf.W + (cf.fR ? cf.fW : 0);
  const dm = Math.max(cf.Dg, cf.Dd);
  const y0 = cf.fy0 || 0;
  const corners = [
    [x0, y0],
    [x1, y0],
    [x1, dm],
    [x0, dm],
  ].map(([a, b]) => [a * co - b * si, a * si + b * co]);

  const mnx = Math.min(...corners.map((p) => p[0]));
  const mny = Math.min(...corners.map((p) => p[1]));
  const mxx = Math.max(...corners.map((p) => p[0]));
  const mxy = Math.max(...corners.map((p) => p[1]));

  return {
    th,
    co,
    si,
    X0: x - mnx,
    Y0: -mny,
    Z0: z,
    w: mxx - mnx,
    d: mxy - mny,
    h: Math.max(cf.H, cf.Hd || cf.H),
  };
}

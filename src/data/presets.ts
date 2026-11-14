import {
  LibraryItem,
  ModuleConfig,
  PanelRole,
  PanelRoleConfig,
} from '../types/furniture';
import { getPanelById } from './carlier-panels';
import { computeAutoClearances } from './blum-hardware';

export function makeRoleConfig(
  panelId: string,
  preferredThickness?: number,
  doubled: boolean = false,
  customSheetL?: number,
  customSheetW?: number,
  allowRotOverride?: boolean
): PanelRoleConfig {
  const panel = getPanelById(panelId);
  const fmt = panel.availableFormats[0] || { length: 2800, width: 2070 };
  const thickness =
    preferredThickness ??
    (panel.standardThicknesses.includes(19)
      ? 19
      : panel.standardThicknesses.includes(18)
      ? 18
      : panel.standardThicknesses[0]);

  return {
    panelId: panel.id,
    thickness,
    doubled,
    sheetL: customSheetL ?? fmt.length,
    sheetW: customSheetW ?? fmt.width,
    allowRot: allowRotOverride !== undefined ? allowRotOverride : !panel.grain,
  };
}

/**
 * Synchronise les propriétés dérivées (t0, t, tInt, t0P, tP, tTr, tb, SL, SW, rot)
 * depuis la configuration par rôle et recalcule les jeux Blum si autoClearances est actif.
 */
export function syncDerivedConfig(cf: ModuleConfig): ModuleConfig {
  const rCorps = cf.roles.corps;
  const rInt = cf.roles.interieur;
  const rFac = cf.roles.facades;
  const rFond = cf.roles.fond;
  const rTir = cf.roles.tiroirs;

  const t0 = rCorps.thickness;
  const dc = rCorps.doubled;
  const t = dc ? t0 * 2 : t0;

  const tInt = rInt.doubled ? rInt.thickness * 2 : rInt.thickness;

  const t0P = rFac.thickness;
  const dp = rFac.doubled;
  const tP = dp ? t0P * 2 : t0P;

  const tTr = rTir.thickness;
  const tb = rFond.thickness;

  const next: ModuleConfig = {
    ...cf,
    t0,
    t,
    dc,
    tInt,
    t0P,
    tP,
    dp,
    tTr,
    tb,
    SL: rCorps.sheetL,
    SW: rCorps.sheetW,
    rot: rCorps.allowRot,
  };

  if (next.autoClearances) {
    const auto = computeAutoClearances(next.hingeId, next.runnerId, tP, tTr);
    if (auto.suggestedHingeId) {
      next.hingeId = auto.suggestedHingeId;
    }
    next.jlat = auto.jlat;
    next.jvd = auto.jvd;
    next.jg = auto.jg;
    next.hingeCupOffset = auto.hingeCupOffset;
  }

  return next;
}

const baseRoles = {
  corps: makeRoleConfig('unilin_h767_lorenzo', 19),
  interieur: makeRoleConfig('unilin_h767_lorenzo', 19),
  facades: makeRoleConfig('unilin_u190_noir', 19),
  fond: makeRoleConfig('unilin_w04_blanc', 8),
  tiroirs: makeRoleConfig('multiplex_bouleau_riga', 15),
};

export const DEFAULT_CONFIG: ModuleConfig = syncDerivedConfig({
  name: 'Module Penderie & Tiroirs',
  W: 800,
  H: 2100,
  Hd: 2100,
  Dg: 580,
  Dd: 580,
  sym: true,
  obH: 'haut',
  obq: 'fond',
  trap: false,
  roles: baseRoles,
  t0: 19,
  t: 19,
  dc: false,
  tInt: 19,
  t0P: 19,
  tP: 19,
  dp: false,
  tTr: 15,
  tb: 8,
  SL: 2800,
  SW: 2070,
  rot: false,
  hasPlinth: true,
  plinthHeight: 80,
  plinthSetback: 25,
  fL: false,
  fR: false,
  fW: 50,
  j: 'A',
  b: 'A',
  fx: 'clamex_p14',
  fxInt: 'clamex_medius',
  mg: 60,
  es: 300,
  hingeId: '71B3550',
  runnerId: 'MOVENTO_BLUMOTION',
  autoClearances: true,
  k: 3.2,
  trim: 10,
  tries: 120,
  jlat: 6,
  jvd: 14,
  jg: 2,
  hingeCupOffset: 22,
});

/**
 * Convertit proprement un ancien fichier projet (v4) vers le modèle v5 multi-rôles
 */
export function migrateModuleConfig(raw: any): ModuleConfig {
  if (raw && raw.roles && raw.roles.corps && raw.roles.fond) {
    return syncDerivedConfig({ ...DEFAULT_CONFIG, ...raw });
  }
  const legacy = raw || {};
  const mapOldMat = (id?: string) => {
    if (id === 'chene_naturel') return 'unilin_h767_lorenzo';
    if (id === 'noir_mat') return 'unilin_u190_noir';
    if (id === 'melamine_blanc') return 'unilin_w04_blanc';
    if (id === 'noyer_canaletto') return 'unilin_h854_walnut';
    if (id === 'contreplaque_bouleau') return 'multiplex_bouleau_riga';
    return 'unilin_h767_lorenzo';
  };
  const mapOldFx = (fx?: string) => {
    if (fx === 'V') return 'confirmat_7x50';
    if (fx === 'T') return 'minifix_tourillons';
    return 'clamex_p14';
  };

  return syncDerivedConfig({
    ...DEFAULT_CONFIG,
    ...legacy,
    fx: mapOldFx(legacy.fx),
    fxInt: 'clamex_medius',
    roles: {
      corps: makeRoleConfig(
        mapOldMat(legacy.matC),
        legacy.t0 || 19,
        Boolean(legacy.dc),
        legacy.SL || 2800,
        legacy.SW || 2070,
        legacy.rot !== undefined ? Boolean(legacy.rot) : false
      ),
      interieur: makeRoleConfig(mapOldMat(legacy.matI), legacy.tInt || 19),
      facades: makeRoleConfig(mapOldMat(legacy.matP), legacy.t0P || 19, Boolean(legacy.dp)),
      fond: makeRoleConfig('unilin_w04_blanc', legacy.tb || 8),
      tiroirs: makeRoleConfig(mapOldMat(legacy.matTr), legacy.tTr || 15),
    },
  });
}

export const PRESET_LIBRARY: LibraryItem[] = [
  {
    name: 'Dressing Penderie & 2 Tiroirs (Chêne & Noir)',
    config: syncDerivedConfig({
      ...DEFAULT_CONFIG,
      name: 'Dressing Penderie & 2 Tiroirs',
      W: 900,
      H: 2200,
      Hd: 2200,
      Dg: 600,
      Dd: 600,
      sym: true,
      roles: {
        corps: makeRoleConfig('unilin_h767_lorenzo', 19),
        interieur: makeRoleConfig('unilin_h767_lorenzo', 19),
        facades: makeRoleConfig('unilin_u190_noir', 19),
        fond: makeRoleConfig('unilin_w04_blanc', 8),
        tiroirs: makeRoleConfig('multiplex_bouleau_riga', 15),
      },
      hingeId: '71B3550-ONYX',
      runnerId: 'MOVENTO_BLUMOTION',
    }),
    tree: {
      cs: true,
      d: 'h',
      k: [
        { t: 'vide', s: 350, p: 0 },
        { t: 'tringle', s: 1200, p: 0, rd: 25, rh: 55 },
        {
          d: 'h',
          s: 500,
          k: [
            { t: 'tiroir', p: 0 },
            { t: 'tiroir', p: 0 },
          ],
        },
      ],
    },
  },
  {
    name: 'Armoire Sous-Pente Droite (Blanc & Chêne Halifax)',
    config: syncDerivedConfig({
      ...DEFAULT_CONFIG,
      name: 'Armoire Sous-Pente Droite',
      W: 1000,
      H: 2100,
      Hd: 1100,
      Dg: 550,
      Dd: 550,
      sym: false,
      obH: 'haut',
      roles: {
        corps: makeRoleConfig('unilin_w04_blanc', 19),
        interieur: makeRoleConfig('unilin_w04_blanc', 19),
        facades: makeRoleConfig('egger_h1180_halifax', 19),
        fond: makeRoleConfig('hdf_unalit_3mm', 4),
        tiroirs: makeRoleConfig('multiplex_bouleau_riga', 15),
      },
      b: 'R',
      fx: 'clamex_p14',
      fxInt: 'clamex_medius',
      hingeId: '71B3550',
      runnerId: 'TANDEM_BLUMOTION',
    }),
    tree: {
      cs: true,
      d: 'v',
      k: [
        {
          d: 'h',
          k: [
            { t: 'tringle', p: 1, pm: 'ov', rd: 25, rh: 50 },
            { t: 'tiroir', p: 0 },
          ],
        },
        {
          d: 'h',
          k: [
            { t: 'vide', p: 1, pm: 'ov' },
            { t: 'vide', p: 1, pm: 'ov' },
            { t: 'tiroir', p: 0 },
          ],
        },
      ],
    },
  },
  {
    name: 'Bibliothèque Salon (Placage Noyer & Fenix NTM)',
    config: syncDerivedConfig({
      ...DEFAULT_CONFIG,
      name: 'Bibliothèque Salon',
      W: 1100,
      H: 2000,
      Hd: 2000,
      Dg: 380,
      Dd: 380,
      sym: true,
      roles: {
        corps: makeRoleConfig('placage_noyer_us', 19),
        interieur: makeRoleConfig('placage_noyer_us', 19),
        facades: makeRoleConfig('fenix_ntm_noir', 19),
        fond: makeRoleConfig('valchromat_noir', 8),
        tiroirs: makeRoleConfig('multiplex_bouleau_riga', 16),
      },
      fx: 'tenso_p14',
      fxInt: 'divario_p18',
      hingeId: '70T3550.TL',
      runnerId: 'LEGRABOX_PURE',
    }),
    tree: {
      cs: true,
      d: 'v',
      k: [
        {
          d: 'h',
          k: [
            { t: 'vide' },
            { t: 'vide' },
            { t: 'vide' },
            { t: 'vide' },
            { t: 'tiroir' },
          ],
        },
        {
          d: 'h',
          k: [
            { t: 'vide' },
            { t: 'vide' },
            { t: 'vide' },
            { t: 'tiroir' },
            { t: 'tiroir' },
          ],
        },
      ],
    },
  },
  {
    name: 'Commode Basse 3 Tiroirs LEGRABOX (Shinnoki)',
    config: syncDerivedConfig({
      ...DEFAULT_CONFIG,
      name: 'Commode Basse 3 Tiroirs',
      W: 800,
      H: 850,
      Hd: 850,
      Dg: 500,
      Dd: 500,
      sym: true,
      roles: {
        corps: makeRoleConfig('decospan_shinnoki_chene', 19),
        interieur: makeRoleConfig('decospan_shinnoki_chene', 19),
        facades: makeRoleConfig('decospan_shinnoki_chene', 19),
        fond: makeRoleConfig('hdf_unalit_3mm', 4),
        tiroirs: makeRoleConfig('unilin_u190_noir', 16),
      },
      j: 'C',
      fx: 'clamex_p14',
      fxInt: 'clamex_medius',
      hingeId: '71B3550',
      runnerId: 'LEGRABOX_PURE',
    }),
    tree: {
      cs: true,
      d: 'h',
      k: [{ t: 'tiroir' }, { t: 'tiroir' }, { t: 'tiroir' }],
    },
  },
];

export const PANEL_ROLES_META: {
  role: PanelRole;
  label: string;
  subtitle: string;
}[] = [
  {
    role: 'corps',
    label: 'Corps du caisson',
    subtitle: 'Côtés, dessus, dessous & plinthe',
  },
  {
    role: 'interieur',
    label: 'Intérieur & tablettes',
    subtitle: 'Cloisons verticales & étagères',
  },
  {
    role: 'facades',
    label: 'Façades & portes',
    subtitle: 'Portes battantes, faces tiroirs & fileurs',
  },
  {
    role: 'fond',
    label: 'Fond arrière',
    subtitle: 'Dos du meuble (HDF 3-4mm, mélaminé 8mm...)',
  },
  {
    role: 'tiroirs',
    label: 'Caissons tiroirs',
    subtitle: 'Côtés/dos bois (ou fond/dos 16mm LEGRABOX)',
  },
];

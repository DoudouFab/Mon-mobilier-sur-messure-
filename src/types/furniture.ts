/**
 * Types & Data Models for Custom Furniture CAD & Woodworking Studio
 * Integrates Carlier Bois (Panels), Blum (Hardware & Clearances), and Lamello P-System (Joinery)
 */

export type MaterialCategory =
  | 'Mélaminés Décors Bois'
  | 'Mélaminés Unis & Matières'
  | 'Stratifiés HPL'
  | 'Placages Bois Nobles'
  | 'MDF & Fibres (HDF)'
  | 'Agglomérés (Particules)'
  | 'Contreplaqués & Multiplex'
  | '3 Plis & Bois Massif'
  | 'Lattés (Blockboard)'
  | 'Compact HPL & OSB';

export interface PanelFormat {
  label: string;
  length: number; // mm (sens du fil)
  width: number;  // mm
}

export interface CarlierPanel {
  id: string;
  brand: string;
  category: MaterialCategory;
  name: string;
  code: string;
  standardThicknesses: number[]; // mm
  availableFormats: PanelFormat[];
  colorHex: string;
  grain: boolean; // Sens du fil par défaut
  roughness: number;
  metalness: number;
  densityKgM3: number;
  pricePerM2: number; // €/m² indicatif HTVA
  edgeBandingAvailable: boolean;
  description?: string;
}

export type PanelRole = 'corps' | 'interieur' | 'facades' | 'fond' | 'tiroirs';

export interface PanelRoleConfig {
  panelId: string;
  thickness: number;
  doubled: boolean;
  sheetL: number; // Longueur commerciale modifiable (mm)
  sheetW: number; // Largeur commerciale modifiable (mm)
  allowRot: boolean; // Autoriser rotation au calepinage (ignorer sens du fil)
}

export type JointType = 'A' | 'B' | 'C'; // A: Dessus/dessous couvrent | B: Côtés couvrent | C: Onglet 45°
export type BackType = 'A' | 'R' | 'N'; // A: En applique | R: En rainure | N: Sans fond
export type ObliqueHeightType = 'haut' | 'bas';
export type ObliqueDepthType = 'fond' | 'avant';

export type LamelloConnectorId =
  | 'clamex_p14'
  | 'clamex_p10'
  | 'clamex_medius'
  | 'tenso_p14'
  | 'tenso_p10'
  | 'divario_p18'
  | 'confirmat_7x50'
  | 'minifix_tourillons';

export type BlumHingeId =
  | '71B3550'
  | '71B3550-ONYX'
  | '71B3750'
  | '71B7550'
  | '71B9550'
  | '70T3550.TL';

export type BlumRunnerId =
  | 'MOVENTO_BLUMOTION'
  | 'MOVENTO_TIPON'
  | 'TANDEM_BLUMOTION'
  | 'LEGRABOX_PURE'
  | 'MERIVOBOX'
  | 'BILLES_45';

export interface ModuleConfig {
  name: string;
  W: number;  // Largeur hors-tout (mm)
  H: number;  // Hauteur gauche Hg (mm)
  Hd: number; // Hauteur droite Hd (mm)
  Dg: number; // Profondeur gauche Dg (mm)
  Dd: number; // Profondeur droite Dd (mm)
  sym: boolean;
  obH: ObliqueHeightType;
  obq: ObliqueDepthType;
  trap: boolean;

  // Configuration indépendante des panneaux par rôle
  roles: {
    corps: PanelRoleConfig;
    interieur: PanelRoleConfig;
    facades: PanelRoleConfig;
    fond: PanelRoleConfig;
    tiroirs: PanelRoleConfig;
  };

  // Valeurs dérivées / compatibilité directe calcul
  t0: number;
  t: number;
  dc: boolean;
  tInt: number;
  t0P: number;
  tP: number;
  dp: boolean;
  tTr: number;
  tb: number;
  SL: number;
  SW: number;
  rot: boolean;

  // Socle / Plinthe
  hasPlinth: boolean;
  plinthHeight: number;
  plinthSetback: number;

  // Fileurs d'ajustement
  fL: boolean;
  fR: boolean;
  fW: number;

  // Assemblage Lamello P-System & Traditionnel
  j: JointType;
  b: BackType;
  fx: LamelloConnectorId;         // Fixation principale du corps
  fxInt: LamelloConnectorId | 'taquets_5mm'; // Fixation tablettes/cloisons intérieures
  mg: number; // Marge d'extrémité Lamello/vis (mm)
  es: number; // Entraxe max fixation (mm)

  // Quincaillerie Blum sélectionnable
  hingeId: BlumHingeId;
  runnerId: BlumRunnerId;
  autoClearances: boolean; // Adaptation automatique des jeux selon la quincaillerie

  // Calepinage global
  k: number;    // Trait de scie (mm)
  trim: number; // Parage des bords (mm)
  tries: number;

  // Jeux de fonctionnement (auto-calibrés ou manuels)
  jlat: number;          // Jeu latéral tiroir (mm)
  jvd: number;           // Jeu vertical dessus/dessous tiroir (mm)
  jg: number;            // Jeu d'ouverture façade/porte (mm)
  hingeCupOffset: number; // Distance centre cuvette Ø35 au bord porte (mm)

  fy0?: number;
}

export type CellContentType = 'vide' | 'tiroir' | 'tringle' | 'etagere';
export type DoorPositionType = 'in' | 'ov';

export interface CompartmentNode {
  cs?: boolean;
  m?: boolean;
  d?: 'v' | 'h';
  k?: CompartmentNode[];
  s?: number;
  t?: CellContentType;
  p?: number;
  pm?: DoorPositionType;
  rd?: number;
  rh?: number;
  shelfCount?: number;
  r?: { x: number; z: number; w: number; h: number };
  i?: { x: number; z: number; w: number; h: number };
  pt?: number[];
}

export interface HoleSpec {
  k: 'f' | 'q' | 'p' | 'v'; // f: face, q: rainure P-System face, p: P-System chant, v: avant-trou vis
  u?: number;
  v?: number;
  d?: number;
  e?: 'g' | 'd' | 'h' | 'b';
  pos?: number;
  a?: 'u' | 'v';
  depth?: number; // Profondeur fraisage/perçage (ex: 14mm ou 10mm)
  connector?: string;
}

export interface PartPiece {
  id?: string;
  name: string;
  role: PanelRole;
  code?: string;
  letter?: string;
  M?: number;
  min: [number, number, number];
  size: [number, number, number];
  L: number;
  l: number;
  t: number;
  th: number;
  bt: number;
  mult: number;
  mat: string;        // Panel ID
  matName: string;    // Human readable Carlier panel name
  colorHex: string;
  woodGrain: boolean;
  roughness: number;
  metalness: number;
  sheetL: number;     // Commercial format L for this part's panel
  sheetW: number;     // Commercial format W for this part's panel
  allowRot: boolean;  // Whether grain allows 90° rotation in nesting
  cut: string;
  f?: string;
  note?: string;
  h: HoleSpec[];
  pl?: [number, number][];
  poly?: [number, number, number][];
  v?: { min: [number, number, number]; size: [number, number, number] };
  obl?: any;
  til?: any;
  dwr?: { d: number };
  dr?: { h: 'L' | 'R'; px: number; pz: number };
  sheets?: string[];
  W2?: number;
  pt?: (wx: number, hz: number) => { u: number; v: number };
  a: number;
  ua: number;
  va: number;
}

export interface HardwareItem {
  k: string;
  q: number;
  L?: number;
  ref?: string;
  category?: 'connectors' | 'hinges' | 'runners' | 'rods' | 'handles' | 'screws';
}

export interface RodItem {
  x0: number;
  x1: number;
  y: number;
  z: number;
  d: number;
}

export interface LamelloValidationMessage {
  level: 'ok' | 'warning' | 'error';
  title: string;
  detail: string;
}

export interface BuiltModuleResult {
  P: PartPiece[];
  nj: number;
  njInt: number;
  cf: ModuleConfig;
  hw: HardwareItem[];
  rods: RodItem[];
  warnings: string[];
  lamelloValidation: LamelloValidationMessage[];
  letter?: string;
  name?: string;
  mt?: {
    th: number;
    co: number;
    si: number;
    X0: number;
    Y0: number;
    Z0: number;
    w: number;
    d: number;
    h: number;
  };
}

export interface AssemblyPlacement {
  modId: number;
  name: string;
  x: number;
  z: number;
  rot: 0 | 90 | 180 | 270;
  w: number;
  h: number;
}

export interface LibraryItem {
  id?: string;
  name: string;
  config: ModuleConfig;
  tree: CompartmentNode;
}

export interface NestingItem {
  it: {
    p: PartPiece;
    w: number;
    h: number;
    comp?: { p: PartPiece; m: number[] }[];
  };
  x: number;
  y: number;
  w: number;
  h: number;
  rt: number;
}

export interface NestingSheet {
  sheetL: number;
  sheetW: number;
  free: { x: number; y: number; w: number; h: number }[];
  items: NestingItem[];
}

export interface NestingGroupResult {
  S: NestingSheet[];
  sheetL: number;
  sheetW: number;
  allowRot: boolean;
  err: string[];
  errP: PartPiece[];
  area: number;
  runs: number;
  pairs: number;
  rem: { x: number; y: number; w: number; h: number } | null;
}

export interface FullProject {
  app: 'plan-mobilier-pro';
  version: 5;
  date: string;
  name: string;
  client?: string;
  form: ModuleConfig;
  tree: CompartmentNode;
  library: LibraryItem[];
  assembly: AssemblyPlacement[];
  editing: number | null;
}

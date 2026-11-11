/**
 * Types & Data Models for Custom Furniture CAD & Woodworking Studio
 */

export type MaterialType =
  | 'melamine_blanc'
  | 'chene_naturel'
  | 'chene_fume'
  | 'noyer_canaletto'
  | 'noir_mat'
  | 'mdf_brut'
  | 'contreplaque_bouleau'
  | 'bois_massif';

export interface MaterialDef {
  id: MaterialType;
  name: string;
  colorHex: string;
  roughness: number;
  metalness: number;
  woodGrain: boolean;
  densityKgM3: number;
  pricePerM2Estimate: number;
}

export type JointType = 'A' | 'B' | 'C'; // A: Dessus/dessous couvrent côtés | B: Côtés couvrent | C: Onglet 45°
export type BackType = 'A' | 'R' | 'N'; // A: En applique | R: En rainure | N: Sans fond
export type FastenerType = 'Z' | 'V' | 'T'; // Z: Lamello Zeta P2 | V: Vis Confirmat | T: Tourillons + Minifix
export type ObliqueHeightType = 'haut' | 'bas'; // Slope top or bottom
export type ObliqueDepthType = 'fond' | 'avant'; // Slope rear or front

export interface ModuleConfig {
  name: string;
  W: number; // Largeur hors-tout (mm)
  H: number; // Hauteur gauche Hg (mm)
  Hd: number; // Hauteur droite Hd (mm)
  Dg: number; // Profondeur gauche Dg (mm)
  Dd: number; // Profondeur droite Dd (mm)
  sym: boolean; // Si true, Hd = H et Dd = Dg
  obH: ObliqueHeightType;
  obq: ObliqueDepthType;
  trap: boolean; // Panneaux horizontaux en trapèze

  // Épaisseurs & Matières
  t0: number; // Épaisseur corps (mm)
  t: number; // Épaisseur effective (t0 * 2 si doublé)
  dc: boolean; // Doubler les panneaux du caisson
  matC: MaterialType;

  tInt: number; // Épaisseur cloisons/étagères (mm)
  matI: MaterialType;

  t0P: number; // Épaisseur portes/façades (mm)
  tP: number;
  dp: boolean; // Doubler les portes
  matP: MaterialType;

  tTr: number; // Épaisseur caisson tiroir (mm)
  matTr: MaterialType;

  // Socle / Plinthe
  hasPlinth: boolean;
  plinthHeight: number; // Hauteur de plinthe (mm)
  plinthSetback: number; // Retrait de plinthe (mm)

  // Fileurs d'ajustement
  fL: boolean; // Fileur gauche
  fR: boolean; // Fileur droit
  fW: number; // Largeur des fileurs (mm)

  // Assemblage & Quincaillerie
  j: JointType;
  b: BackType;
  tb: number; // Épaisseur du fond (mm)
  fx: FastenerType;
  mg: number; // Marge au bout pour quincaillerie (mm)
  es: number; // Entraxe max fixation (mm)

  // Panneau brut & Calepinage
  SL: number; // Longueur panneau brut (mm) - ex: 2800 ou 2400
  SW: number; // Largeur panneau brut (mm) - ex: 2070 ou 1200
  k: number; // Trait de scie (mm) - ex: 3.2
  trim: number; // Parage des bords (mm) - ex: 10
  tries: number; // Itérations d'optimisation (50 - 500)
  rot: boolean; // Rotation autorisée (si décor sans sens du fil)

  // Jeux de fonctionnement
  jlat: number; // Jeu latéral tiroir (mm) - 12.5mm coulisse à bille
  jvd: number; // Jeu dessus/dessous tiroir (mm)
  jg: number; // Jeu d'ouverture portes (mm)

  // Offset calculé pour faces
  fy0?: number;
}

export type CellContentType = 'vide' | 'tiroir' | 'tringle' | 'etagere';
export type DoorPositionType = 'in' | 'ov'; // in: rentrante | ov: en recouvrement

export interface CompartmentNode {
  cs?: boolean; // Est un caisson individuel
  m?: boolean; // Est un groupe/division de modules
  d?: 'v' | 'h'; // Direction de division: vertical (colonnes) ou horizontal (lignes)
  k?: CompartmentNode[]; // Enfants
  s?: number; // Taille forcée en mm (sinon équilibré)
  t?: CellContentType; // Type de contenu
  p?: number; // Nombre de portes (0, 1, 2)
  pm?: DoorPositionType; // Pose des portes
  rd?: number; // Diamètre tringle (20, 25, 30mm)
  rh?: number; // Distance axe tringle sous plafond de case (mm)
  shelfCount?: number; // Pour division étagères rapides
  r?: { x: number; z: number; w: number; h: number }; // Bounding box calculé
  i?: { x: number; z: number; w: number; h: number }; // Espace intérieur utile
  pt?: number[]; // Chemin d'accès dans l'arbre [0, 1, ...]
}

export interface HoleSpec {
  k: 'f' | 'q' | 'p' | 'v'; // f: perçage face, q: rainure P-10 Zeta, p: connecteur P-14 chant, v: avant-trou chant
  u?: number;
  v?: number;
  d?: number; // Diamètre perçage (35mm charnière, 5mm taquet/vis, etc.)
  e?: 'g' | 'd' | 'h' | 'b'; // Chant gauche, droit, haut, bas
  pos?: number;
  a?: 'u' | 'v';
}

export interface PartPiece {
  id?: string;
  name: string;
  code?: string;
  letter?: string;
  M?: number; // Index du module
  min: [number, number, number]; // [x, y, z]
  size: [number, number, number]; // [w, d, h]
  L: number; // Longueur finie (mm)
  l: number; // Largeur finie (mm)
  t: number; // Épaisseur brute (mm)
  th: number;
  bt: number;
  mult: number;
  mat: MaterialType;
  cut: string; // Ex: '90°' ou 'biseau 18.5°'
  f?: string;
  note?: string;
  h: HoleSpec[]; // Perçages / usinages
  pl?: [number, number][]; // Contour polygonal si trapèze ou biseau
  poly?: [number, number, number][];
  v?: { min: [number, number, number]; size: [number, number, number] };
  obl?: any;
  til?: any;
  dwr?: { d: number }; // Déplacement animation tiroir
  dr?: { h: 'L' | 'R'; px: number; pz: number }; // Pivot animation porte
  sheets?: string[]; // Feuilles de calepinage assignées
  W2?: number;
  pt?: (wx: number, hz: number) => { u: number; v: number };
  a: number;
  ua: number;
  va: number;
  // Edge banding (chants plaqués)
  edgeL1?: boolean; // Chant longueur 1
  edgeL2?: boolean; // Chant longueur 2
  edgeW1?: boolean; // Chant largeur 1
  edgeW2?: boolean; // Chant largeur 2
}

export interface HardwareItem {
  k: string;
  q: number;
  L?: number;
  category?: 'connectors' | 'hinges' | 'runners' | 'rods' | 'handles' | 'screws';
}

export interface RodItem {
  x0: number;
  x1: number;
  y: number;
  z: number;
  d: number;
}

export interface BuiltModuleResult {
  P: PartPiece[];
  nj: number;
  cf: ModuleConfig;
  hw: HardwareItem[];
  rods: RodItem[];
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
  modId: number; // Index dans la bibliothèque
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
  rt: number; // 0 ou 1
}

export interface NestingSheet {
  free: { x: number; y: number; w: number; h: number }[];
  items: NestingItem[];
}

export interface NestingGroupResult {
  S: NestingSheet[];
  err: string[];
  errP: PartPiece[];
  area: number;
  runs: number;
  pairs: number;
  rem: { x: number; y: number; w: number; h: number } | null;
}

export interface FullProject {
  app: 'plan-mobilier-pro';
  version: 4;
  date: string;
  name: string;
  client?: string;
  form: ModuleConfig;
  tree: CompartmentNode;
  library: LibraryItem[];
  assembly: AssemblyPlacement[];
  editing: number | null;
}

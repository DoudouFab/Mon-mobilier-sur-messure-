/**
 * Lamello P-System Configurator Engine
 * Référence officielle : https://lamello.com/be/fr/solutions/lamello-expertise/configurateur-p-system
 *
 * Contient les règles d'usinage Zeta P2 / CNC, profondeurs de fraisage,
 * épaisseurs minimales selon l'angle (90° vs onglet 45° vs montant médian) et quincaillerie.
 */

import { LamelloConnectorId, LamelloValidationMessage, ModuleConfig } from '../types/furniture';

export interface LamelloSystemSpec {
  id: LamelloConnectorId;
  name: string;
  brand: 'Lamello P-System' | 'Traditionnel';
  removable: boolean;
  glued: boolean;
  grooveDepthMm: number; // Profondeur de fraise P-System (14mm, 10mm, 18mm)
  cutterSpec: string; // Ex: 'Fraise P-System Ø100,4 × 7 × 22 mm'
  accessHoleMm?: number; // Ø6 mm pour Clamex
  minThickness90Mm: number;
  minThickness45MiterMm: number | null; // null si non adapté en onglet
  minThicknessMediusCenterMm?: number; // Montant central partagé face à face
  idealThicknessMm: number;
  maxSpacingMm: number;
  edgeMarginMm: number;
  machiningNotes: string;
  bomLabel: string;
}

export const LAMELLO_SYSTEMS: Record<LamelloConnectorId, LamelloSystemSpec> = {
  clamex_p14: {
    id: 'clamex_p14',
    name: 'Lamello Clamex P-14 (Démontable universel)',
    brand: 'Lamello P-System',
    removable: true,
    glued: false,
    grooveDepthMm: 14,
    cutterSpec: 'Fraise diamant/carbure P-System Ø100,4 × 7 × 22 mm (Zeta P2 prof. 14)',
    accessHoleMm: 6,
    minThickness90Mm: 15,
    minThickness45MiterMm: 18,
    minThicknessMediusCenterMm: 28, // Pour P-14 face à face sans Medius
    idealThicknessMm: 19,
    maxSpacingMm: 300,
    edgeMarginMm: 60,
    machiningNotes:
      'Rainure P-System prof. 14 mm. Trou d’accès Ø6 mm pour clé Allen à 15,5 mm du bord (angle 90°) ou sur face intérieure.',
    bomLabel: 'Connecteurs démontables Lamello Clamex P-14 (paire + vis/levier)',
  },
  clamex_p10: {
    id: 'clamex_p10',
    name: 'Lamello Clamex P-10 (Panneaux fins / compacts)',
    brand: 'Lamello P-System',
    removable: true,
    glued: false,
    grooveDepthMm: 10,
    cutterSpec: 'Fraise P-System Ø100,4 × 7 × 22 mm (Zeta P2 prof. 10)',
    accessHoleMm: 6,
    minThickness90Mm: 12,
    minThickness45MiterMm: 15,
    minThicknessMediusCenterMm: 22,
    idealThicknessMm: 15,
    maxSpacingMm: 280,
    edgeMarginMm: 55,
    machiningNotes:
      'Rainure P-System prof. 10 mm. Adapté dès 12–13 mm à 90° (chant ≥1 mm recommandé) et dès 15 mm en onglet 45°.',
    bomLabel: 'Connecteurs compacts Lamello Clamex P-10 (paire)',
  },
  clamex_medius: {
    id: 'clamex_medius',
    name: 'Lamello Clamex P-14/10 Medius (Cloison médiane)',
    brand: 'Lamello P-System',
    removable: true,
    glued: false,
    grooveDepthMm: 10,
    cutterSpec: 'Fraise P-System Ø100,4 × 7 × 22 mm (prof. 10 côté montant / 14 côté tablette)',
    accessHoleMm: 6,
    minThickness90Mm: 16,
    minThickness45MiterMm: null,
    minThicknessMediusCenterMm: 16,
    idealThicknessMm: 19,
    maxSpacingMm: 300,
    edgeMarginMm: 60,
    machiningNotes:
      'Spécial cloisons intermédiaires dès 16 mm : permet deux tablettes face à face au même niveau sans interférence.',
    bomLabel: 'Connecteurs cloison médiane Lamello Clamex P-14/10 Medius (paire)',
  },
  tenso_p14: {
    id: 'tenso_p14',
    name: 'Lamello Tenso P-14 (Auto-serrant collé invisible)',
    brand: 'Lamello P-System',
    removable: false,
    glued: true,
    grooveDepthMm: 14,
    cutterSpec: 'Fraise P-System Ø100,4 × 7 × 22 mm (Zeta P2 prof. 14)',
    minThickness90Mm: 15,
    minThickness45MiterMm: 18,
    idealThicknessMm: 19,
    maxSpacingMm: 250,
    edgeMarginMm: 55,
    machiningNotes:
      'Assemblage 100% invisible sans trou d’accès ! Auto-serrage puissant pendant la prise de la colle blanche PVAc (avec pré-clip).',
    bomLabel: 'Connecteurs auto-serrants Lamello Tenso P-14 + pré-clips',
  },
  tenso_p10: {
    id: 'tenso_p10',
    name: 'Lamello Tenso P-10 (Auto-serrant mince dès 12mm)',
    brand: 'Lamello P-System',
    removable: false,
    glued: true,
    grooveDepthMm: 10,
    cutterSpec: 'Fraise P-System Ø100,4 × 7 × 22 mm (Zeta P2 prof. 10)',
    minThickness90Mm: 12,
    minThickness45MiterMm: 15,
    idealThicknessMm: 16,
    maxSpacingMm: 250,
    edgeMarginMm: 50,
    machiningNotes:
      'Auto-serrant invisible pour panneaux minces dès 12 mm. Aucun serre-joint requis.',
    bomLabel: 'Connecteurs auto-serrants Lamello Tenso P-10 + pré-clips',
  },
  divario_p18: {
    id: 'divario_p18',
    name: 'Lamello Divario P-18 (Coulissant invisible tablettes)',
    brand: 'Lamello P-System',
    removable: true,
    glued: false,
    grooveDepthMm: 18,
    cutterSpec: 'Fraise P-System + rainure de coulissement (prof. 14 / 18 mm)',
    minThickness90Mm: 18,
    minThickness45MiterMm: null,
    idealThicknessMm: 19,
    maxSpacingMm: 300,
    edgeMarginMm: 60,
    machiningNotes:
      'Tablette insérée par coulissement frontal invisible. Aucun trou apparent, serrage automatique lors de l’insertion.',
    bomLabel: 'Connecteurs coulissants Lamello Divario P-18 (paire)',
  },
  confirmat_7x50: {
    id: 'confirmat_7x50',
    name: 'Vis Confirmat 7×50 mm (Traversantes)',
    brand: 'Traditionnel',
    removable: true,
    glued: false,
    grooveDepthMm: 0,
    cutterSpec: 'Foret étagé Confirmat Ø5 / Ø7 mm',
    minThickness90Mm: 15,
    minThickness45MiterMm: null,
    idealThicknessMm: 18,
    maxSpacingMm: 300,
    edgeMarginMm: 50,
    machiningNotes: 'Perçage traversant Ø7 mm en face et avant-trou Ø5 mm × 40 mm en chant.',
    bomLabel: 'Vis Confirmat d’assemblage 7×50 mm zinguées + caches',
  },
  minifix_tourillons: {
    id: 'minifix_tourillons',
    name: 'Excentriques Minifix Ø15 + Tourillons Ø8×30',
    brand: 'Traditionnel',
    removable: true,
    glued: false,
    grooveDepthMm: 12,
    cutterSpec: 'Mèche Ø15 mm (boîtier), Ø8 mm (tourillon), Ø5 mm (goujon)',
    minThickness90Mm: 15,
    minThickness45MiterMm: null,
    idealThicknessMm: 18,
    maxSpacingMm: 280,
    edgeMarginMm: 50,
    machiningNotes: 'Boîtier Ø15 prof. 12.5 mm à 34 mm du bord, tourillons bois Ø8 mm.',
    bomLabel: 'Boîtiers excentriques Minifix Ø15 + Goujons + Tourillons Ø8×30',
  },
};

/**
 * Valide la compatibilité technique entre les épaisseurs/coupes et le système Lamello choisi
 * (Réplique la logique du Configurateur P-System Lamello)
 */
export function validateLamelloConfig(cf: ModuleConfig): LamelloValidationMessage[] {
  const msgs: LamelloValidationMessage[] = [];
  const corpsSpec = LAMELLO_SYSTEMS[cf.fx];
  const tCorps = cf.t;
  const tInt = cf.tInt;
  const isMiter = cf.j === 'C';

  // 1. Vérification du corps (angles extérieurs)
  if (isMiter) {
    if (corpsSpec.minThickness45MiterMm === null) {
      msgs.push({
        level: 'error',
        title: `${corpsSpec.name} incompatible en onglet 45°`,
        detail: `Utilisez Clamex P-14 (≥18mm), Clamex P-10 (≥15mm), Tenso P-14 ou Tenso P-10 pour une coupe à 45°.`,
      });
    } else if (tCorps < corpsSpec.minThickness45MiterMm) {
      msgs.push({
        level: 'error',
        title: `Épaisseur insuffisante pour onglet 45° (${tCorps} mm)`,
        detail: `${corpsSpec.name} requiert au moins ${corpsSpec.minThickness45MiterMm} mm en coupe à 45° (actuel : ${tCorps} mm). Passez à P-10 ou augmentez l'épaisseur.`,
      });
    } else {
      msgs.push({
        level: 'ok',
        title: `Onglet 45° validé (${corpsSpec.name})`,
        detail: `Panneau ${tCorps} mm conforme (min. ${corpsSpec.minThickness45MiterMm} mm). Profondeur fraisage ${corpsSpec.grooveDepthMm} mm.`,
      });
    }
  } else {
    if (tCorps < corpsSpec.minThickness90Mm) {
      msgs.push({
        level: 'error',
        title: `Panneau corps trop fin (${tCorps} mm < ${corpsSpec.minThickness90Mm} mm)`,
        detail: `${corpsSpec.name} nécessite ≥ ${corpsSpec.minThickness90Mm} mm à 90°. Basculez vers Clamex P-10 ou Tenso P-10 (dès 12 mm).`,
      });
    } else {
      msgs.push({
        level: 'ok',
        title: `Assemblage corps 90° validé (${corpsSpec.name})`,
        detail: `Panneau ${tCorps} mm conforme (profondeur fraisage ${corpsSpec.grooveDepthMm} mm${
          corpsSpec.accessHoleMm ? `, trou Ø${corpsSpec.accessHoleMm} mm` : ''
        }).`,
      });
    }
  }

  // 2. Vérification de l'aménagement intérieur (étagères / cloisons)
  if (cf.fxInt !== 'taquets_5mm') {
    const intSpec = LAMELLO_SYSTEMS[cf.fxInt];
    if (tInt < intSpec.minThickness90Mm) {
      msgs.push({
        level: 'error',
        title: `Épaisseur intérieure trop faible (${tInt} mm) pour ${intSpec.name}`,
        detail: `Minimum requis : ${intSpec.minThickness90Mm} mm (ex: Divario P-18 exige ≥ 18 mm, Medius exige ≥ 16 mm).`,
      });
    } else if (cf.fxInt === 'clamex_p14' && tInt < 28) {
      msgs.push({
        level: 'warning',
        title: `Cloisons intermédiaires ${tInt} mm avec Clamex P-14`,
        detail: `Pour deux tablettes fixées exactement au même niveau face à face sur une cloison de ${tInt} mm, préférez Clamex P-14/10 Medius (dès 16 mm) ou décalez de 10 mm.`,
      });
    } else {
      msgs.push({
        level: 'ok',
        title: `Intérieur validé (${intSpec.name})`,
        detail: `Cloisons/étagères ${tInt} mm conformes (prof. fraisage ${intSpec.grooveDepthMm} mm).`,
      });
    }
  }

  return msgs;
}

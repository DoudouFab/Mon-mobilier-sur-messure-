/**
 * Catalogue complet de Quincaillerie de Meuble - Blum Belgique
 * https://www.blum.com/be/fr/
 *
 * Contient les ferrures sélectionnables et leurs jeux techniques exacts :
 * Lorsqu'une charnière ou coulisse est sélectionnée, les jeux de fabrication
 * (jlat, jvd, jg, perçage cuvette) s'adaptent automatiquement.
 */

import { BlumHingeId, BlumRunnerId } from '../types/furniture';

export interface BlumHinge {
  id: BlumHingeId;
  ref: string;
  name: string;
  openingAngle: number;
  mountingType: 'recouvrement' | 'rentrante' | 'grand_angle' | 'porte_epaisse';
  finish: 'Nickelé' | 'Noir Onyx';
  cupDiameterMm: number;
  cupEdgeOffsetMm: number; // Distance centre cuvette Ø35 au chant de porte (22 mm standard, 23 mm porte épaisse)
  recommendedDoorGapMm: number; // Jeu d'ouverture minimal (jg)
  maxDoorThicknessMm: number;
  blumotionIntegrated: boolean;
  tipOnRequired: boolean;
  notes: string;
}

export interface BlumRunner {
  id: BlumRunnerId;
  series: 'MOVENTO' | 'TANDEM' | 'LEGRABOX' | 'MERIVOBOX' | 'STANDARD';
  refBase: string;
  name: string;
  nominalLengthsMm: number[];
  loadCapacityKg: 30 | 40 | 45 | 70;
  motionTechnology: 'BLUMOTION' | 'TIP-ON BLUMOTION' | 'STANDARD';
  isMetalBox: boolean; // true pour LEGRABOX / MERIVOBOX (parois métal fournies, pas de côtés bois à débiter)
  sideClearancePerSideMm: number; // Jeu latéral par côté (jlat) : ex. 12.5mm pour MOVENTO (SKW = LW - 42mm pour côté 16mm -> 21mm/côté si on inclut épaisseur ou 12.5mm entre côté et montant)
  verticalClearanceMm: number; // Jeu vertical haut/bas (jvd)
  recommendedFrontGapMm: number; // Jeu façade (jg) - plus grand si TIP-ON (2.5mm min pour course)
  maxDrawerSideThicknessMm: number;
  bottomClearanceMm: number;
  notes: string;
}

export const BLUM_HINGES: Record<BlumHingeId, BlumHinge> = {
  '71B3550': {
    id: '71B3550',
    ref: '71B3550',
    name: 'Blum CLIP top BLUMOTION 110° Standard (Nickelé)',
    openingAngle: 110,
    mountingType: 'recouvrement',
    finish: 'Nickelé',
    cupDiameterMm: 35,
    cupEdgeOffsetMm: 22,
    recommendedDoorGapMm: 2.0,
    maxDoorThicknessMm: 24,
    blumotionIntegrated: true,
    tipOnRequired: false,
    notes: 'Amortisseur BLUMOTION intégré. Jeu minimal 2,0 mm.',
  },
  '71B3550-ONYX': {
    id: '71B3550-ONYX',
    ref: '71B3550 ONYX',
    name: 'Blum CLIP top BLUMOTION 110° Noir Onyx Design',
    openingAngle: 110,
    mountingType: 'recouvrement',
    finish: 'Noir Onyx',
    cupDiameterMm: 35,
    cupEdgeOffsetMm: 22,
    recommendedDoorGapMm: 2.0,
    maxDoorThicknessMm: 24,
    blumotionIntegrated: true,
    tipOnRequired: false,
    notes: 'Finition sombre Noir Onyx pour caissons noirs, noyer ou chêne fumé.',
  },
  '71B3750': {
    id: '71B3750',
    ref: '71B3750',
    name: 'Blum CLIP top BLUMOTION 110° Rentrante (Encastrée)',
    openingAngle: 110,
    mountingType: 'rentrante',
    finish: 'Nickelé',
    cupDiameterMm: 35,
    cupEdgeOffsetMm: 22,
    recommendedDoorGapMm: 1.5,
    maxDoorThicknessMm: 22,
    blumotionIntegrated: true,
    tipOnRequired: false,
    notes: 'Spéciale porte encastrée dans le caisson. Jeu périphérique 1,5 mm.',
  },
  '71B7550': {
    id: '71B7550',
    ref: '71B7550',
    name: 'Blum CLIP top BLUMOTION 155° Grand Angle 0-protrusion',
    openingAngle: 155,
    mountingType: 'grand_angle',
    finish: 'Nickelé',
    cupDiameterMm: 35,
    cupEdgeOffsetMm: 22,
    recommendedDoorGapMm: 2.5,
    maxDoorThicknessMm: 24,
    blumotionIntegrated: true,
    tipOnRequired: false,
    notes: 'Zéro débord intérieur à 90° : permet la sortie libre de tiroirs à l’anglaise.',
  },
  '71B9550': {
    id: '71B9550',
    ref: '71B9550',
    name: 'Blum CLIP top BLUMOTION 95° Portes Épaisses (jusqu’à 32 mm)',
    openingAngle: 95,
    mountingType: 'porte_epaisse',
    finish: 'Nickelé',
    cupDiameterMm: 35,
    cupEdgeOffsetMm: 23.5,
    recommendedDoorGapMm: 3.0,
    maxDoorThicknessMm: 32,
    blumotionIntegrated: true,
    tipOnRequired: false,
    notes: 'Indispensable si façade > 22 mm (ou portes doublées). Jeu d’ouverture augmenté à 3,0 mm.',
  },
  '70T3550.TL': {
    id: '70T3550.TL',
    ref: '70T3550.TL + 956A1004',
    name: 'Blum CLIP top 110° sans ressort + TIP-ON (Sans poignée)',
    openingAngle: 110,
    mountingType: 'recouvrement',
    finish: 'Nickelé',
    cupDiameterMm: 35,
    cupEdgeOffsetMm: 22,
    recommendedDoorGapMm: 3.0,
    maxDoorThicknessMm: 24,
    blumotionIntegrated: false,
    tipOnRequired: true,
    notes: 'Loqueteau magnétique TIP-ON : jeu façade calibré à 3,0 mm pour la course de déclenchement.',
  },
};

export const BLUM_RUNNERS: Record<BlumRunnerId, BlumRunner> = {
  MOVENTO_BLUMOTION: {
    id: 'MOVENTO_BLUMOTION',
    series: 'MOVENTO',
    refBase: '760H',
    name: 'Blum MOVENTO 40 kg avec BLUMOTION (Tiroir bois)',
    nominalLengthsMm: [250, 270, 300, 350, 400, 450, 500, 550, 600],
    loadCapacityKg: 40,
    motionTechnology: 'BLUMOTION',
    isMetalBox: false,
    sideClearancePerSideMm: 5.0, // Espace libre entre extérieur côté tiroir et paroi caisson (SKW = LW - 42mm avec côtés 16mm -> 5mm de jeu latéral par côté + 16mm côté = 21mm)
    verticalClearanceMm: 14, // Jeu bas/haut combiné (coulisse sous fond + espace réglage)
    recommendedFrontGapMm: 2.0,
    maxDrawerSideThicknessMm: 16,
    bottomClearanceMm: 28.5,
    notes: 'Coulisses invisibles sous tiroir bois (côtés max 16 mm). Jeu latéral 5 mm/côté (SKW = LW - 42mm).',
  },
  MOVENTO_TIPON: {
    id: 'MOVENTO_TIPON',
    series: 'MOVENTO',
    refBase: '760H-TOB',
    name: 'Blum MOVENTO TIP-ON BLUMOTION 40 kg (Sans poignée)',
    nominalLengthsMm: [270, 300, 350, 400, 450, 500, 550, 600],
    loadCapacityKg: 40,
    motionTechnology: 'TIP-ON BLUMOTION',
    isMetalBox: false,
    sideClearancePerSideMm: 5.0,
    verticalClearanceMm: 14,
    recommendedFrontGapMm: 2.5,
    maxDrawerSideThicknessMm: 16,
    bottomClearanceMm: 28.5,
    notes: 'Ouverture par pression + fermeture amortie. Jeu façade porté à 2,5 mm pour déclenchement.',
  },
  TANDEM_BLUMOTION: {
    id: 'TANDEM_BLUMOTION',
    series: 'TANDEM',
    refBase: '560H',
    name: 'Blum TANDEM plus BLUMOTION 30 kg (Tiroir bois)',
    nominalLengthsMm: [250, 270, 300, 350, 400, 450, 500, 550],
    loadCapacityKg: 30,
    motionTechnology: 'BLUMOTION',
    isMetalBox: false,
    sideClearancePerSideMm: 5.0,
    verticalClearanceMm: 13,
    recommendedFrontGapMm: 2.0,
    maxDrawerSideThicknessMm: 16,
    bottomClearanceMm: 27.0,
    notes: 'Sortie totale invisible économique pour tiroirs bois (côtés max 16 mm).',
  },
  LEGRABOX_PURE: {
    id: 'LEGRABOX_PURE',
    series: 'LEGRABOX',
    refBase: '770C / 770M',
    name: 'Blum LEGRABOX pure (Côtés métal droits 12,8 mm - Gris Orion)',
    nominalLengthsMm: [270, 300, 350, 400, 450, 500, 550, 600, 650],
    loadCapacityKg: 40,
    motionTechnology: 'BLUMOTION',
    isMetalBox: true,
    sideClearancePerSideMm: 19.0, // Fond débité à LW - 38mm (19mm par côté)
    verticalClearanceMm: 15,
    recommendedFrontGapMm: 2.0,
    maxDrawerSideThicknessMm: 16,
    bottomClearanceMm: 24.5,
    notes: 'Box métallique complet : les côtés sont fournis en kit Blum, seuls le fond et le dos sont débités (LW - 38 mm).',
  },
  MERIVOBOX: {
    id: 'MERIVOBOX',
    series: 'MERIVOBOX',
    refBase: '450M',
    name: 'Blum MERIVOBOX (Côtés métal modulaire - Blanc Soie / Gris)',
    nominalLengthsMm: [270, 300, 350, 400, 450, 500, 550, 600],
    loadCapacityKg: 40,
    motionTechnology: 'BLUMOTION',
    isMetalBox: true,
    sideClearancePerSideMm: 19.5, // Fond LW - 39mm / dos LW - 31mm
    verticalClearanceMm: 15,
    recommendedFrontGapMm: 2.0,
    maxDrawerSideThicknessMm: 16,
    bottomClearanceMm: 25.0,
    notes: 'Plateforme modulaire Blum : côtés métal fournis, fond/dos bois 16 mm débités automatiquement.',
  },
  BILLES_45: {
    id: 'BILLES_45',
    series: 'STANDARD',
    refBase: 'BILLE-45',
    name: 'Coulisses à billes latérales standard 45 mm',
    nominalLengthsMm: [250, 300, 350, 400, 450, 500, 550, 600],
    loadCapacityKg: 45,
    motionTechnology: 'STANDARD',
    isMetalBox: false,
    sideClearancePerSideMm: 12.7, // Standard 12.7 mm (1/2 pouce) par côté
    verticalClearanceMm: 6,
    recommendedFrontGapMm: 2.0,
    maxDrawerSideThicknessMm: 19,
    bottomClearanceMm: 10,
    notes: 'Fixation latérale classique : jeu strict de 12,7 mm de chaque côté du caisson tiroir.',
  },
};

export const BLUM_CATALOG = {
  hinges: Object.values(BLUM_HINGES),
  runners: Object.values(BLUM_RUNNERS),
};

/**
 * Calcule les jeux optimaux en fonction des ferrures Blum choisies et de l'épaisseur de façade
 */
export function computeAutoClearances(
  hingeId: BlumHingeId,
  runnerId: BlumRunnerId,
  doorThicknessMm: number,
  drawerSideThicknessMm: number = 15
): {
  jlat: number;
  jvd: number;
  jg: number;
  hingeCupOffset: number;
  suggestedHingeId?: BlumHingeId;
  notes: string[];
} {
  const hinge = BLUM_HINGES[hingeId] || BLUM_HINGES['71B3550'];
  const runner = BLUM_RUNNERS[runnerId] || BLUM_RUNNERS.MOVENTO_BLUMOTION;
  const notes: string[] = [];

  let suggestedHingeId: BlumHingeId | undefined;
  let activeHinge = hinge;

  // Si porte épaisse > maxDoorThicknessMm (ex: > 24 mm), recommander automatiquement 71B9550
  if (doorThicknessMm > hinge.maxDoorThicknessMm && hingeId !== '71B9550') {
    suggestedHingeId = '71B9550';
    activeHinge = BLUM_HINGES['71B9550'];
    notes.push(
      `Porte épaisse (${doorThicknessMm} mm) : charnière auto-adaptée à 95° (71B9550) avec jeu de 3,0 mm.`
    );
  }

  // Pour MOVENTO / TANDEM, Blum impose SKW = LW - 42 mm quel que soit l'épaisseur du côté bois (≤16 mm)
  const jlat =
    runner.series === 'MOVENTO' || runner.series === 'TANDEM'
      ? Math.max(4, Math.round((21 - drawerSideThicknessMm) * 10) / 10)
      : runner.sideClearancePerSideMm;

  const jvd = runner.verticalClearanceMm;
  const jg = Math.max(activeHinge.recommendedDoorGapMm, runner.recommendedFrontGapMm);
  const hingeCupOffset = activeHinge.cupEdgeOffsetMm;

  notes.push(
    `Jeux calibrés : coulisse ${runner.series} (jeu lat. ${jlat} mm, vert. ${jvd} mm) · charnière ${activeHinge.ref} (jeu porte ${jg} mm, axe Ø35 à ${hingeCupOffset} mm).`
  );

  return { jlat, jvd, jg, hingeCupOffset, suggestedHingeId, notes };
}

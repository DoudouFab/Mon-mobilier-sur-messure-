/**
 * Catalogue complet de Quincaillerie de Meuble - Blum Belgique
 * https://www.blum.com/be/fr/
 * 
 * Contient les systèmes phares de ferrure pour caissons et meubles sur-mesure :
 * 1. Charnières CLIP top & CLIP top BLUMOTION (110°, 155° grand angle, profil épais 95°, Noir Onyx / Nickelé)
 * 2. Coulisses invisibles pour tiroirs bois MOVENTO & TANDEM (Sortie totale, 40kg/60kg, BLUMOTION / TIP-ON)
 * 3. Systèmes de tiroirs métalliques double paroi LEGRABOX pure & MERIVOBOX
 * 4. Systèmes d'ouverture sans poignée TIP-ON pour portes et tiroirs
 * 5. Relevants pour meubles hauts AVENTOS (HF, HK top, HK-S)
 * 6. Embases réglables EXPANDO et gabarits de perçage
 */

export interface BlumHinge {
  ref: string;
  name: string;
  openingAngle: number;
  mountingType: 'recouvrement' | 'rentrante' | 'onglet' | 'grand_angle';
  finish: 'Nickelé' | 'Noir Onyx';
  cupDiameterMm: number; // 35mm standard
  drillingDistanceMm: number; // Distance bord de porte au boîtier (3..7mm, défaut 22mm pour centre axe cuvette)
  blumotionIntegrated: boolean;
  tipOnCompatible: boolean;
  notes: string;
}

export interface BlumRunner {
  series: 'MOVENTO' | 'TANDEM' | 'LEGRABOX' | 'MERIVOBOX';
  refBase: string;
  name: string;
  nominalLengthsMm: number[]; // 250, 270, 300, 350, 400, 450, 500, 550, 600, 650, 700
  loadCapacityKg: 40 | 60 | 70;
  extensionType: 'sortie_totale' | 'sortie_simple';
  motionTechnology: 'BLUMOTION' | 'TIP-ON BLUMOTION' | 'TIP-ON' | 'SERVO-DRIVE';
  sideClearancePerSideMm: number; // 12.5mm pour MOVENTO/TANDEM
  bottomClearanceMm: number; // 28.5mm
  notes: string;
}

export interface BlumHardwareCatalog {
  hinges: BlumHinge[];
  runners: BlumRunner[];
  liftSystems: {
    ref: string;
    name: string;
    type: 'HF' | 'HK_top' | 'HK_S';
    notes: string;
  }[];
  tipOnUnits: {
    ref: string;
    name: string;
    forDoors: boolean;
    strokeMm: number;
  }[];
}

export const BLUM_CATALOG: BlumHardwareCatalog = {
  hinges: [
    {
      ref: '71B3550',
      name: 'Blum CLIP top BLUMOTION 110° Standard (Recouvrement)',
      openingAngle: 110,
      mountingType: 'recouvrement',
      finish: 'Nickelé',
      cupDiameterMm: 35,
      drillingDistanceMm: 22,
      blumotionIntegrated: true,
      tipOnCompatible: false,
      notes: 'La référence mondiale pour portes battantes. Amortisseur intégré dans le boîtier.',
    },
    {
      ref: '71B3750',
      name: 'Blum CLIP top BLUMOTION 110° Rentrante (Encastrée)',
      openingAngle: 110,
      mountingType: 'rentrante',
      finish: 'Nickelé',
      cupDiameterMm: 35,
      drillingDistanceMm: 22,
      blumotionIntegrated: true,
      tipOnCompatible: false,
      notes: 'Pour portes en retrait entre montants de caisson.',
    },
    {
      ref: '71B3550-ONYX',
      name: 'Blum CLIP top BLUMOTION 110° Noir Onyx Design',
      openingAngle: 110,
      mountingType: 'recouvrement',
      finish: 'Noir Onyx',
      cupDiameterMm: 35,
      drillingDistanceMm: 22,
      blumotionIntegrated: true,
      tipOnCompatible: false,
      notes: 'Finition sombre élégante pour intérieurs noirs, noyer ou chêne foncé.',
    },
    {
      ref: '71B7550',
      name: 'Blum CLIP top BLUMOTION 155° Grand Angle 0-protrusion',
      openingAngle: 155,
      mountingType: 'grand_angle',
      finish: 'Nickelé',
      cupDiameterMm: 35,
      drillingDistanceMm: 22,
      blumotionIntegrated: true,
      tipOnCompatible: false,
      notes: 'Permet aux tiroirs intérieurs à l’anglaise de sortir sans buter dans la porte.',
    },
    {
      ref: '70T3550.TL',
      name: 'Blum CLIP top 110° sans ressort (spécial TIP-ON sans poignée)',
      openingAngle: 110,
      mountingType: 'recouvrement',
      finish: 'Nickelé',
      cupDiameterMm: 35,
      drillingDistanceMm: 22,
      blumotionIntegrated: false,
      tipOnCompatible: true,
      notes: 'À associer au loqueteau magnétique TIP-ON pour façade épurée sans poignée.',
    },
  ],

  runners: [
    {
      series: 'MOVENTO',
      refBase: '760H',
      name: 'Blum MOVENTO avec BLUMOTION (Sortie totale synchronisée 40 kg)',
      nominalLengthsMm: [250, 270, 300, 350, 400, 450, 500, 550, 600],
      loadCapacityKg: 40,
      extensionType: 'sortie_totale',
      motionTechnology: 'BLUMOTION',
      sideClearancePerSideMm: 12.5,
      bottomClearanceMm: 28.5,
      notes: 'Le summum du coulissement pour tiroir bois : réglage 4D de face sans outil.',
    },
    {
      series: 'MOVENTO',
      refBase: '760H-TIPON',
      name: 'Blum MOVENTO TIP-ON BLUMOTION (Push-to-Open + Amorti 40 kg)',
      nominalLengthsMm: [270, 300, 350, 400, 450, 500, 550, 600],
      loadCapacityKg: 40,
      extensionType: 'sortie_totale',
      motionTechnology: 'TIP-ON BLUMOTION',
      sideClearancePerSideMm: 12.5,
      bottomClearanceMm: 28.5,
      notes: 'Ouverture par pression sur la face et fermeture douce amortie.',
    },
    {
      series: 'TANDEM',
      refBase: '560H',
      name: 'Blum TANDEM plus BLUMOTION (Sortie totale 30 kg)',
      nominalLengthsMm: [250, 270, 300, 350, 400, 450, 500, 550],
      loadCapacityKg: 40,
      extensionType: 'sortie_totale',
      motionTechnology: 'BLUMOTION',
      sideClearancePerSideMm: 12.0,
      bottomClearanceMm: 27.0,
      notes: 'Solution classique éprouvée pour tiroirs ébénisterie et dressings.',
    },
    {
      series: 'LEGRABOX',
      refBase: 'LEGRA-PURE',
      name: 'Blum LEGRABOX pure (Tiroir métallique côtés droits 12.8 mm - Gris Orion)',
      nominalLengthsMm: [270, 300, 350, 400, 450, 500, 550, 600, 650],
      loadCapacityKg: 40,
      extensionType: 'sortie_totale',
      motionTechnology: 'BLUMOTION',
      sideClearancePerSideMm: 13.0,
      bottomClearanceMm: 24.5,
      notes: 'Design cubique épuré haut de gamme. Côtés métal ultra-fins sans perte de place.',
    },
  ],

  liftSystems: [
    {
      ref: 'AVENTOS-HF',
      name: 'Blum AVENTOS HF - Porte pliante relevable pour meuble haut',
      type: 'HF',
      notes: 'Deux vantaux qui se replient vers le haut. Grande accessibilité sans gêne à hauteur de tête.',
    },
    {
      ref: 'AVENTOS-HK-TOP',
      name: 'Blum AVENTOS HK top - Porte relevable compacte avec BLUMOTION',
      type: 'HK_top',
      notes: 'Ferrure compacte pour portes relevables de caissons hauts.',
    },
  ],

  tipOnUnits: [
    {
      ref: '956A1004',
      name: 'Blum TIP-ON version longue (course 38 mm avec aimant)',
      forDoors: true,
      strokeMm: 38,
    },
    {
      ref: '956.1004',
      name: 'Blum TIP-ON version courte (course 17 mm avec aimant)',
      forDoors: true,
      strokeMm: 17,
    },
  ],
};

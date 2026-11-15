import { getPanelById } from '../data/carlier-panels';
import { HardwareRefPrices, ReferencePricingConfig } from '../types/furniture';

export const REF_PRICING_STORAGE_KEY = 'atelier_ref_pricing_v1';

export const DEFAULT_HARDWARE_REF_PRICES: HardwareRefPrices = {
  hinge110: 8.5,
  hinge155: 14.5,
  runnerMovento: 48.0,
  runnerTandem: 34.0,
  runnerLegraboxMerivobox: 78.0,
  runnerStandard: 22.0,
  lamelloClamex: 1.85,
  lamelloTenso: 1.45,
  lamelloDivario: 2.1,
  taquets: 0.4,
  tringle: 18.0,
  poignee: 9.0,
  divers: 1.2,
};

export const HARDWARE_PRICE_LABELS: {
  key: keyof HardwareRefPrices;
  label: string;
  unit: string;
}[] = [
  { key: 'hinge110', label: 'Charnière Blum 110° CLIP top BLUMOTION', unit: '€/u' },
  { key: 'hinge155', label: 'Charnière Blum 155° Grand Angle', unit: '€/u' },
  { key: 'runnerLegraboxMerivobox', label: 'Kit tiroir Blum LEGRABOX / MERIVOBOX', unit: '€/paire' },
  { key: 'runnerMovento', label: 'Coulisses Blum MOVENTO', unit: '€/paire' },
  { key: 'runnerTandem', label: 'Coulisses Blum TANDEM', unit: '€/paire' },
  { key: 'runnerStandard', label: 'Coulisses à billes standard', unit: '€/paire' },
  { key: 'lamelloClamex', label: 'Connecteur Lamello Clamex (P-14 / P-10 / Medius)', unit: '€/paire' },
  { key: 'lamelloTenso', label: 'Connecteur Lamello Tenso (P-14 / P-10)', unit: '€/paire' },
  { key: 'lamelloDivario', label: 'Connecteur Lamello Divario P-18', unit: '€/paire' },
  { key: 'taquets', label: 'Taquets Ø5 / Vis Confirmat / Tourillons', unit: '€/u' },
  { key: 'tringle', label: 'Tringle penderie ovale & supports', unit: '€/u' },
  { key: 'poignee', label: 'Poignée / bouton standard', unit: '€/u' },
  { key: 'divers', label: 'Autre quincaillerie diverse', unit: '€/u' },
];

export const DEFAULT_REFERENCE_PRICING: ReferencePricingConfig = {
  panelPrices: {},
  panelDiscountPct: 0,
  prixChantMl: 3.8,
  hardwarePrices: { ...DEFAULT_HARDWARE_REF_PRICES },
  hardwareItemOverrides: {},
};

export function loadReferencePricing(): ReferencePricingConfig {
  try {
    const raw = localStorage.getItem(REF_PRICING_STORAGE_KEY);
    if (!raw) return cloneDefaultPricing();
    const parsed = JSON.parse(raw);
    return {
      panelPrices: parsed.panelPrices && typeof parsed.panelPrices === 'object' ? parsed.panelPrices : {},
      panelDiscountPct: Number.isFinite(Number(parsed.panelDiscountPct))
        ? Number(parsed.panelDiscountPct)
        : 0,
      prixChantMl: Number.isFinite(Number(parsed.prixChantMl))
        ? Number(parsed.prixChantMl)
        : DEFAULT_REFERENCE_PRICING.prixChantMl,
      hardwarePrices: {
        ...DEFAULT_HARDWARE_REF_PRICES,
        ...(parsed.hardwarePrices || {}),
      },
      hardwareItemOverrides:
        parsed.hardwareItemOverrides && typeof parsed.hardwareItemOverrides === 'object'
          ? parsed.hardwareItemOverrides
          : {},
    };
  } catch {
    return cloneDefaultPricing();
  }
}

export function cloneDefaultPricing(): ReferencePricingConfig {
  return {
    panelPrices: {},
    panelDiscountPct: 0,
    prixChantMl: DEFAULT_REFERENCE_PRICING.prixChantMl,
    hardwarePrices: { ...DEFAULT_HARDWARE_REF_PRICES },
    hardwareItemOverrides: {},
  };
}

export function saveReferencePricing(pricing: ReferencePricingConfig): void {
  try {
    localStorage.setItem(REF_PRICING_STORAGE_KEY, JSON.stringify(pricing));
  } catch {
    // Ignore storage failures
  }
}

export function getEffectivePanelPricePerM2(
  panelId: string,
  pricing: ReferencePricingConfig
): number {
  const custom = pricing.panelPrices[panelId];
  if (custom !== undefined && Number.isFinite(custom) && custom >= 0) {
    return custom;
  }
  const catalogDefault = getPanelById(panelId)?.pricePerM2 ?? 32;
  const discount = Math.min(80, Math.max(-100, pricing.panelDiscountPct || 0));
  return Math.round(catalogDefault * (1 - discount / 100) * 100) / 100;
}

export function detectHardwarePriceCategory(itemKey: string): keyof HardwareRefPrices {
  const lower = itemKey.toLowerCase();
  if (lower.includes('legrabox') || lower.includes('merivobox')) return 'runnerLegraboxMerivobox';
  if (lower.includes('movento')) return 'runnerMovento';
  if (lower.includes('tandem')) return 'runnerTandem';
  if (lower.includes('coulisse')) return 'runnerStandard';
  if (lower.includes('155°')) return 'hinge155';
  if (lower.includes('charnière') || lower.includes('71b') || lower.includes('70t')) return 'hinge110';
  if (lower.includes('clamex')) return 'lamelloClamex';
  if (lower.includes('tenso')) return 'lamelloTenso';
  if (lower.includes('divario')) return 'lamelloDivario';
  if (lower.includes('tringle')) return 'tringle';
  if (lower.includes('poignée')) return 'poignee';
  if (lower.includes('taquet') || lower.includes('confirmat') || lower.includes('minifix') || lower.includes('vis')) {
    return 'taquets';
  }
  return 'divers';
}

export function getEffectiveHardwareUnitPrice(
  itemKey: string,
  pricing: ReferencePricingConfig
): number {
  const exact = pricing.hardwareItemOverrides[itemKey];
  if (exact !== undefined && Number.isFinite(exact) && exact >= 0) {
    return exact;
  }
  const cat = detectHardwarePriceCategory(itemKey);
  const val = pricing.hardwarePrices[cat];
  return Number.isFinite(val) ? val : DEFAULT_HARDWARE_REF_PRICES[cat];
}

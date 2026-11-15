import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FilePlus2,
  History,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  BuiltModuleResult,
  HardwareRefPrices,
  NestingGroupResult,
  PartPiece,
  QuoteClient,
  QuoteCompanyParams,
  QuoteDocument,
  QuoteIndexEntry,
  QuoteLine,
  QuoteStatus,
  ReferencePricingConfig,
  VatRate,
} from '../types/furniture';
import { CARLIER_PANELS_CATALOG, getPanelById } from '../data/carlier-panels';
import {
  cloneDefaultPricing,
  getEffectiveHardwareUnitPrice,
  getEffectivePanelPricePerM2,
  HARDWARE_PRICE_LABELS,
  loadReferencePricing,
  saveReferencePricing,
} from '../utils/pricing';
import { R } from '../utils/woodworking-math';

interface QuoteManagerProps {
  modules: BuiltModuleResult[];
  allPieces: PartPiece[];
  nestingResults: Record<string, NestingGroupResult>;
  hardwareSummary: Record<string, number>;
  projectName: string;
  onShowToast: (msg: string) => void;
}

const STORAGE_PREFIX = 'atelier_devis_v1:';
const KEY_INDEX = `${STORAGE_PREFIX}index`;
const KEY_PARAMS = `${STORAGE_PREFIX}params`;
const KEY_CLIENTS = `${STORAGE_PREFIX}clients`;
const KEY_DOC_PREFIX = `${STORAGE_PREFIX}doc:`;

const MENUISERIE_CATALOGUE: [string, string][] = [
  ['Panneaux & Découpe', 'Panneaux mélaminés / stratifiés découpés au format'],
  ['Panneaux & Découpe', 'Fourniture et découpe panneau Carlier Bois'],
  ['Panneaux & Découpe', 'Placage de chants ABS assortis (ép. 1 mm / 2 mm)'],
  ['Usinage & Assemblage', 'Usinage CNC Lamello P-System (Clamex / Tenso / Divario)'],
  ['Usinage & Assemblage', 'Perçage charnières et tourillons / montage atelier'],
  ['Quincaillerie', 'Lot quincaillerie Blum (charnières BLUMOTION, coulisses)'],
  ['Quincaillerie', 'Système de tiroirs Blum (Movento / Legrabox / Merivobox)'],
  ['Quincaillerie', 'Poignées, tringles penderie et accessoires'],
  ['Façades & Finition', 'Façades sur mesure et réglage des jeux'],
  ['Façades & Finition', 'Finition vernis / huile / laque atelier'],
  ['Logistique & Pose', 'Livraison et manutention sur chantier'],
  ['Logistique & Pose', 'Pose, mise à niveau et ajustements sur site'],
  ['Logistique & Pose', 'Nettoyage et évacuation des emballages'],
];

const DEFAULT_COMPANY_PARAMS: QuoteCompanyParams = {
  entreprise: 'Votre Atelier de Menuiserie',
  sousTitre: 'Mobilier sur mesure · Agencement intérieur · Découpe & Pose',
  adresse: 'Rue de l’Atelier 12, 5000 Namur',
  tel: '0470 / 00 00 00',
  mail: 'contact@votre-atelier.be',
  tvaNum: 'BE 0000.000.000',
  iban: 'BE00 0000 0000 0000',
  auteur: 'Menuisier-Agenceur',
  validiteMois: 1,
  conditions:
    '- Devis valable 30 jours, à renvoyer signé avec la mention « Bon pour accord ».\n- Acompte de 40 % à la commande, solde à la réception des travaux.\n- Délai indicatif de fabrication : 4 à 6 semaines après validation des plans et prise de mesures.',
  unites: ['Forfait', 'Panneau', 'M²', 'Ml', 'Pièce', 'Heures', 'Compris'],
  catalogue: MENUISERIE_CATALOGUE,
  margeCoef: 1.35,
  forfaitUsinagePiece: 6.5,
  tarifHorairePose: 65,
};

const STATUTS: Record<QuoteStatus, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
};

const eurFormatter = new Intl.NumberFormat('fr-BE', {
  style: 'currency',
  currency: 'EUR',
});

function formatEur(n: number): string {
  return eurFormatter.format(Number.isFinite(n) ? n : 0);
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + (n < 0 ? -1 : 1) * 1e-9) * 100) / 100;
}

// Safe recursive-descent arithmetic evaluator for spreadsheet inputs like "=2.8*2.07 + 15"
function safeEvaluateMath(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^=/, '')
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(/,/g, '.');
  if (!cleaned || !/^[0-9.+\-*/()]+$/.test(cleaned)) return null;

  let pos = 0;
  const peek = () => cleaned[pos] || '';
  const consume = () => cleaned[pos++] || '';

  const parseFactor = (): number => {
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    if (peek() === '(') {
      consume();
      const val = parseExpr();
      if (peek() === ')') consume();
      return val;
    }
    const start = pos;
    while (/[0-9.]/.test(peek())) consume();
    const numStr = cleaned.slice(start, pos);
    const num = Number(numStr);
    if (!numStr || !Number.isFinite(num)) throw new Error('NaN');
    return num;
  };

  const parseTerm = (): number => {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '*') left *= right;
      else {
        if (right === 0) throw new Error('Div0');
        left /= right;
      }
    }
    return left;
  };

  const parseExpr = (): number => {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  try {
    const res = parseExpr();
    if (pos !== cleaned.length || !Number.isFinite(res)) return null;
    return res;
  } catch {
    return null;
  }
}

function parseNumeric(val: string | number | undefined): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const trimmed = String(val).trim();
  const mathVal = safeEvaluateMath(trimmed);
  if (mathVal !== null) return mathVal;
  const direct = parseFloat(trimmed.replace(/\s/g, '').replace(/€/g, '').replace(/,/g, '.'));
  return Number.isFinite(direct) ? direct : 0;
}

function isoToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addMonthsIso(dateIso: string, months: number): string {
  const d = dateIso ? new Date(`${dateIso}T12:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return isoToday();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.max(1, months));
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateFr(dateIso: string): string {
  if (!dateIso) return '—';
  const parts = dateIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateIso;
}

function makeLineId(): string {
  return `ln_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeQuoteNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(100 + Math.random() * 899));
  return `DEV-${y}${m}-${seq}`;
}

function emptyQuote(company: QuoteCompanyParams): QuoteDocument {
  const today = isoToday();
  return {
    id: null,
    number: makeQuoteNumber(),
    statut: 'brouillon',
    date: today,
    validite: addMonthsIso(today, company.validiteMois || 1),
    auteur: company.auteur || '',
    client: { nom: '', adr1: '', adr2: '', tel: '', mail: '' },
    description: '',
    lignes: [
      { id: makeLineId(), type: '', poste: '', qte: '', pu: '', tot: '' },
      { id: makeLineId(), type: '', poste: '', qte: '', pu: '', tot: '' },
      { id: makeLineId(), type: '', poste: '', qte: '', pu: '', tot: '' },
    ],
    tva: '0.21',
    sousTotal: '',
    forcedSousTotal: false,
    remarques: company.conditions,
    cree: null,
    maj: null,
  };
}

function vatMultiplier(tva: VatRate): number {
  if (tva === '0.06') return 0.06;
  if (tva === '0.12') return 0.12;
  if (tva === '0.21') return 0.21;
  return 0;
}

export const QuoteManager: React.FC<QuoteManagerProps> = ({
  modules,
  allPieces,
  nestingResults,
  hardwareSummary,
  projectName,
  onShowToast,
}) => {
  const [company, setCompany] = useState<QuoteCompanyParams>(() => {
    try {
      const saved = localStorage.getItem(KEY_PARAMS);
      if (!saved) return DEFAULT_COMPANY_PARAMS;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return DEFAULT_COMPANY_PARAMS;
      return {
        ...DEFAULT_COMPANY_PARAMS,
        ...parsed,
        unites: Array.isArray(parsed.unites) ? parsed.unites : DEFAULT_COMPANY_PARAMS.unites,
        catalogue: Array.isArray(parsed.catalogue)
          ? parsed.catalogue
          : DEFAULT_COMPANY_PARAMS.catalogue,
      };
    } catch {
      return DEFAULT_COMPANY_PARAMS;
    }
  });

  const [index, setIndex] = useState<QuoteIndexEntry[]>(() => {
    try {
      const saved = localStorage.getItem(KEY_INDEX);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [clients, setClients] = useState<QuoteClient[]>(() => {
    try {
      const saved = localStorage.getItem(KEY_CLIENTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [quote, setQuote] = useState<QuoteDocument>(() => emptyQuote(company));
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [validiteManual, setValiditeManual] = useState<boolean>(false);

  // Drawers & UI states
  const [openDrawer, setOpenDrawer] = useState<'history' | 'params' | null>(null);
  const [paramsTab, setParamsTab] = useState<'company' | 'panels' | 'hardware' | 'catalog'>(
    'company'
  );
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'sheets' | 'net_m2'>('sheets');
  const [previousSnapshot, setPreviousSnapshot] = useState<{
    description: string;
    lignes: QuoteLine[];
  } | null>(null);

  // Editable reference pricing (panels €/m², edge banding €/ml, hardware €/u)
  const [pricing, setPricing] = useState<ReferencePricingConfig>(() => loadReferencePricing());
  const [pricingDraft, setPricingDraft] = useState<ReferencePricingConfig>(() =>
    loadReferencePricing()
  );
  const [panelPriceSearch, setPanelPriceSearch] = useState<string>('');
  const [panelOnlyProject, setPanelOnlyProject] = useState<boolean>(false);

  // Local state for settings editor
  const [paramsDraft, setParamsDraft] = useState<QuoteCompanyParams>(company);
  const [unitesText, setUnitesText] = useState<string>(company.unites.join(', '));
  const [catalogueText, setCatalogueText] = useState<string>(
    company.catalogue.map((c) => `${c[0]} | ${c[1]}`).join('\n')
  );

  // Sync params & pricing drafts whenever params drawer opens
  useEffect(() => {
    if (openDrawer === 'params') {
      setParamsDraft(company);
      setUnitesText(company.unites.join(', '));
      setCatalogueText(company.catalogue.map((c) => `${c[0]} | ${c[1]}`).join('\n'));
      setPricingDraft(loadReferencePricing());
    }
  }, [openDrawer, company]);

  // Compute totals reactively
  const totals = useMemo(() => {
    let autoSub = 0;
    const computedLineDisplays = quote.lignes.map((line) => {
      if (line.forcedTotal && line.tot.trim() !== '') {
        const v = roundMoney(parseNumeric(line.tot));
        autoSub += v;
        return line.tot;
      }
      if (line.type === 'Compris') {
        return 'Compris';
      }
      if (!line.qte.trim() && !line.pu.trim()) {
        return '';
      }
      const lineTotal = roundMoney(roundMoney(parseNumeric(line.qte)) * roundMoney(parseNumeric(line.pu)));
      autoSub += lineTotal;
      return formatEur(lineTotal);
    });

    autoSub = roundMoney(autoSub);
    const subTotal = roundMoney(
      quote.forcedSousTotal && quote.sousTotal.trim() !== ''
        ? parseNumeric(quote.sousTotal)
        : autoSub
    );
    const vatAmount = roundMoney(subTotal * vatMultiplier(quote.tva));
    const grandTotal = roundMoney(subTotal + vatAmount);

    return { computedLineDisplays, autoSub, subTotal, vatAmount, grandTotal };
  }, [quote.lignes, quote.forcedSousTotal, quote.sousTotal, quote.tva]);

  const updateQuoteField = <K extends keyof QuoteDocument>(key: K, value: QuoteDocument[K]) => {
    setQuote((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleClientNameChange = (name: string) => {
    const matched = clients.find(
      (c) => c.nom.trim().toLowerCase() === name.trim().toLowerCase()
    );
    setQuote((prev) => {
      if (matched) {
        const fillAdr1 = !prev.client.adr1.trim() ? matched.adr1 : prev.client.adr1;
        const fillAdr2 = !prev.client.adr2.trim() ? matched.adr2 : prev.client.adr2;
        const fillTel = !prev.client.tel.trim() ? matched.tel : prev.client.tel;
        const fillMail = !prev.client.mail.trim() ? matched.mail : prev.client.mail;
        return {
          ...prev,
          client: { nom: name, adr1: fillAdr1, adr2: fillAdr2, tel: fillTel, mail: fillMail },
        };
      }
      return { ...prev, client: { ...prev.client, nom: name } };
    });
    setIsDirty(true);
  };

  const updateLine = (idx: number, patch: Partial<QuoteLine>) => {
    setQuote((prev) => {
      const next = [...prev.lignes];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, lignes: next };
    });
    setIsDirty(true);
  };

  const handleBlurMathField = (
    idx: number,
    field: 'qte' | 'pu' | 'tot',
    isCurrency: boolean
  ) => {
    const line = quote.lignes[idx];
    if (!line) return;
    const raw = line[field];
    if (!raw || !raw.trim()) return;
    const evaluated = safeEvaluateMath(raw);
    if (evaluated === null) return;
    const rounded = roundMoney(evaluated);
    updateLine(idx, {
      [field]: isCurrency ? formatEur(rounded) : String(rounded).replace('.', ','),
    });
  };

  const addLines = (count: number) => {
    setQuote((prev) => ({
      ...prev,
      lignes: [
        ...prev.lignes,
        ...Array.from({ length: count }, () => ({
          id: makeLineId(),
          type: '',
          poste: '',
          qte: '',
          pu: '',
          tot: '',
        })),
      ],
    }));
    setIsDirty(true);
  };

  const removeLine = (idx: number) => {
    setQuote((prev) => {
      const filtered = prev.lignes.filter((_, i) => i !== idx);
      return {
        ...prev,
        lignes:
          filtered.length > 0
            ? filtered
            : [{ id: makeLineId(), type: '', poste: '', qte: '', pu: '', tot: '' }],
      };
    });
    setIsDirty(true);
  };

  // --- Link directly with 3D Furniture Project ---
  const handleImportFrom3DProject = () => {
    if (allPieces.length === 0) {
      onShowToast('Aucune pièce générée dans le projet 3D.');
      return;
    }

    setPreviousSnapshot({
      description: quote.description,
      lignes: JSON.parse(JSON.stringify(quote.lignes)),
    });

    const coef = company.margeCoef || 1.35;
    const generatedLines: QuoteLine[] = [];

    const activePricing = loadReferencePricing();
    setPricing(activePricing);

    // 1. Panels by nesting sheet OR net m²
    const groupEntries = Object.entries(nestingResults);
    if (importMode === 'sheets' && groupEntries.length > 0) {
      groupEntries.forEach(([groupKey, grp]) => {
        const repPart = grp.S[0]?.items[0]?.it?.p;
        const pricePerM2 = repPart
          ? getEffectivePanelPricePerM2(repPart.mat, activePricing)
          : 32;
        const sheetAreaM2 = (grp.sheetL * grp.sheetW) / 1_000_000;
        const unitSheetPrice = roundMoney(sheetAreaM2 * pricePerM2 * coef);
        const sheetCount = grp.S.length;

        generatedLines.push({
          id: makeLineId(),
          type: 'Panneau',
          poste: `Fourniture & débit panneau : ${groupKey}`,
          qte: String(sheetCount),
          pu: formatEur(unitSheetPrice),
          tot: '',
        });
      });
    } else {
      // Net m² grouped by material
      const byMat: Record<string, { label: string; matId: string; m2: number }> = {};
      allPieces.forEach((p) => {
        const k = `${p.matName || p.mat} (${p.bt}mm)`;
        if (!byMat[k]) byMat[k] = { label: k, matId: p.mat, m2: 0 };
        byMat[k].m2 += ((p.L * p.l) / 1_000_000) * (p.mult || 1);
      });
      Object.values(byMat).forEach((m) => {
        const refPrice = getEffectivePanelPricePerM2(m.matId, activePricing);
        const unitPrice = roundMoney(refPrice * 1.15 * coef);
        generatedLines.push({
          id: makeLineId(),
          type: 'M²',
          poste: `Panneau découpé (chutes incluses +15%) : ${m.label}`,
          qte: String(roundMoney(m.m2)).replace('.', ','),
          pu: formatEur(unitPrice),
          tot: '',
        });
      });
    }

    // 2. Edge banding estimate (front & visible perimeter on corps/facades/interieur)
    const edgeMeters = roundMoney(
      allPieces.reduce((acc, p) => {
        if (p.role === 'fond') return acc;
        // Exposed front + visible sides conservative workshop estimate
        return acc + ((p.L + p.l) / 1000) * (p.role === 'facades' ? 2 : 1.1);
      }, 0)
    );
    if (edgeMeters > 0) {
      generatedLines.push({
        id: makeLineId(),
        type: 'Ml',
        poste: 'Placage de chants ABS assortis (chants apparents & façades)',
        qte: String(edgeMeters).replace('.', ','),
        pu: formatEur(roundMoney((activePricing.prixChantMl || 3.8) * coef)),
        tot: '',
      });
    }

    // 3. Hardware summary (Blum + Lamello)
    const hwEntries = Object.entries(hardwareSummary);
    if (hwEntries.length > 0) {
      const totalHwCost = hwEntries.reduce(
        (sum, [itemName, qty]) => sum + getEffectiveHardwareUnitPrice(itemName, activePricing) * qty,
        0
      );
      const clientHwPrice = roundMoney(totalHwCost * coef);
      const summaryNames = hwEntries
        .slice(0, 3)
        .map(([k, q]) => `${q}× ${k.split('[')[0].trim()}`)
        .join(', ');
      generatedLines.push({
        id: makeLineId(),
        type: 'Forfait',
        poste: `Quincaillerie Blum & Assemblage P-System (${summaryNames}${
          hwEntries.length > 3 ? ` + ${hwEntries.length - 3} réf.` : ''
        })`,
        qte: '1',
        pu: formatEur(clientHwPrice),
        tot: '',
      });
    }

    // 4. CNC Machining & Workshop assembly
    generatedLines.push({
      id: makeLineId(),
      type: 'Pièce',
      poste: 'Usinage CNC / Lamello P-System, perçages et pré-montage atelier',
      qte: String(allPieces.length),
      pu: formatEur(roundMoney(company.forfaitUsinagePiece || 6.5)),
      tot: '',
    });

    // 5. Site installation
    const estHours = Math.max(2, Math.round(modules.length * 2.5 + allPieces.length * 0.12));
    generatedLines.push({
      id: makeLineId(),
      type: 'Heures',
      poste: 'Livraison, pose, calage et réglage final des façades sur chantier',
      qte: String(estHours),
      pu: formatEur(roundMoney(company.tarifHorairePose || 65)),
      tot: '',
    });

    const totalWidth = modules.reduce((s, m) => s + m.cf.W, 0);
    const maxHeight = Math.max(...modules.map((m) => Math.max(m.cf.H, m.cf.Hd)));
    const maxDepth = Math.max(...modules.map((m) => Math.max(m.cf.Dg, m.cf.Dd)));
    const autoDesc = `Réalisation et pose de mobilier sur mesure : ${
      modules.length > 1
        ? `Ensemble « ${projectName} » (${modules.length} modules)`
        : `Module « ${modules[0]?.name || projectName} »`
    } — Dimensions globales env. ${R(totalWidth)} × ${R(maxHeight)} × ${R(maxDepth)} mm (${
      allPieces.length
    } pièces débitées).`;

    setQuote((prev) => ({
      ...prev,
      description: prev.description.trim() ? prev.description : autoDesc,
      lignes: generatedLines,
      forcedSousTotal: false,
      sousTotal: '',
    }));
    setIsDirty(true);
    onShowToast(`Chiffrage importé depuis le projet 3D (${generatedLines.length} postes).`);
  };

  const handleRevertImport = () => {
    if (!previousSnapshot) return;
    setQuote((prev) => ({
      ...prev,
      description: previousSnapshot.description,
      lignes: previousSnapshot.lignes,
    }));
    setPreviousSnapshot(null);
    setIsDirty(true);
    onShowToast('Import annulé, lignes précédentes restaurées.');
  };

  // --- Save / Load / Duplicate / Delete ---
  const saveQuote = () => {
    const id =
      quote.id || `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const cleanedLines = quote.lignes.filter(
      (l) => l.type || l.poste || l.qte || l.pu || l.tot
    );

    const toSave: QuoteDocument = {
      ...quote,
      id,
      cree: quote.cree || now,
      maj: now,
      lignes: cleanedLines.length > 0 ? cleanedLines : quote.lignes.slice(0, 1),
    };

    try {
      localStorage.setItem(`${KEY_DOC_PREFIX}${id}`, JSON.stringify(toSave));

      const entry: QuoteIndexEntry = {
        id,
        number: toSave.number,
        client: toSave.client.nom.trim(),
        date: toSave.date,
        total: totals.grandTotal,
        statut: toSave.statut,
        maj: now,
      };
      const nextIndex = [entry, ...index.filter((x) => x.id !== id)].sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
      );
      localStorage.setItem(KEY_INDEX, JSON.stringify(nextIndex));
      setIndex(nextIndex);

      if (toSave.client.nom.trim()) {
        const normalized = toSave.client.nom.trim().toLowerCase();
        const nextClients = [
          { ...toSave.client, nom: toSave.client.nom.trim() },
          ...clients.filter((c) => c.nom.trim().toLowerCase() !== normalized),
        ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
        localStorage.setItem(KEY_CLIENTS, JSON.stringify(nextClients));
        setClients(nextClients);
      }

      setQuote(toSave);
      setIsDirty(false);
      onShowToast(`Devis ${toSave.number} enregistré.`);
    } catch {
      onShowToast('Impossible d’enregistrer dans le navigateur.');
    }
  };

  const openSavedQuote = (id: string) => {
    try {
      const raw = localStorage.getItem(`${KEY_DOC_PREFIX}${id}`);
      if (!raw) {
        onShowToast('Devis introuvable.');
        return;
      }
      const parsed: QuoteDocument = JSON.parse(raw);
      setQuote(parsed);
      setValiditeManual(true);
      setIsDirty(false);
      setOpenDrawer(null);
      onShowToast(`Devis ${parsed.number || parsed.client.nom} ouvert.`);
    } catch {
      onShowToast('Erreur de lecture du devis.');
    }
  };

  const duplicateSavedQuote = (id: string) => {
    try {
      const raw = localStorage.getItem(`${KEY_DOC_PREFIX}${id}`);
      if (!raw) return;
      const parsed: QuoteDocument = JSON.parse(raw);
      const today = isoToday();
      setQuote({
        ...parsed,
        id: null,
        number: makeQuoteNumber(),
        statut: 'brouillon',
        date: today,
        validite: addMonthsIso(today, company.validiteMois || 1),
        cree: null,
        maj: null,
        lignes: parsed.lignes.map((l) => ({ ...l, id: makeLineId() })),
      });
      setValiditeManual(false);
      setIsDirty(true);
      setOpenDrawer(null);
      onShowToast('Devis dupliqué (nouveau brouillon).');
    } catch {
      onShowToast('Impossible de dupliquer.');
    }
  };

  const deleteSavedQuote = (id: string) => {
    try {
      localStorage.removeItem(`${KEY_DOC_PREFIX}${id}`);
      const nextIndex = index.filter((x) => x.id !== id);
      localStorage.setItem(KEY_INDEX, JSON.stringify(nextIndex));
      setIndex(nextIndex);
      if (quote.id === id) {
        setQuote((prev) => ({ ...prev, id: null }));
        setIsDirty(true);
      }
      setConfirmDeleteId(null);
      onShowToast('Devis supprimé.');
    } catch {
      onShowToast('Suppression impossible.');
    }
  };

  const cycleQuoteStatus = (id: string) => {
    const order: QuoteStatus[] = ['brouillon', 'envoye', 'accepte', 'refuse'];
    const target = index.find((x) => x.id === id);
    if (!target) return;
    const nextStatus = order[(order.indexOf(target.statut) + 1) % order.length];

    try {
      const raw = localStorage.getItem(`${KEY_DOC_PREFIX}${id}`);
      if (raw) {
        const doc: QuoteDocument = JSON.parse(raw);
        doc.statut = nextStatus;
        doc.maj = Date.now();
        localStorage.setItem(`${KEY_DOC_PREFIX}${id}`, JSON.stringify(doc));
      }
      const nextIndex = index.map((x) =>
        x.id === id ? { ...x, statut: nextStatus } : x
      );
      localStorage.setItem(KEY_INDEX, JSON.stringify(nextIndex));
      setIndex(nextIndex);
      if (quote.id === id) setQuote((prev) => ({ ...prev, statut: nextStatus }));
    } catch {
      onShowToast('Erreur mise à jour statut.');
    }
  };

  const saveCompanySettings = () => {
    const parsedUnits = unitesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedCatalogue: [string, string][] = catalogueText
      .split('\n')
      .map((line) => {
        const parts = line.split('|');
        if (parts.length < 2) {
          return parts[0].trim() ? (['Divers', parts[0].trim()] as [string, string]) : null;
        }
        const cat = parts[0].trim();
        const item = parts.slice(1).join('|').trim();
        return item ? ([cat || 'Divers', item] as [string, string]) : null;
      })
      .filter((x): x is [string, string] => x !== null);

    const updated: QuoteCompanyParams = {
      ...paramsDraft,
      validiteMois: Math.max(1, Number(paramsDraft.validiteMois) || 1),
      margeCoef: Math.max(1, Number(paramsDraft.margeCoef) || 1),
      forfaitUsinagePiece: Math.max(0, Number(paramsDraft.forfaitUsinagePiece) || 0),
      tarifHorairePose: Math.max(0, Number(paramsDraft.tarifHorairePose) || 0),
      unites: parsedUnits.length > 0 ? parsedUnits : DEFAULT_COMPANY_PARAMS.unites,
      catalogue: parsedCatalogue.length > 0 ? parsedCatalogue : MENUISERIE_CATALOGUE,
    };

    try {
      localStorage.setItem(KEY_PARAMS, JSON.stringify(updated));
      saveReferencePricing(pricingDraft);
      setCompany(updated);
      setPricing(pricingDraft);
      setOpenDrawer(null);
      onShowToast('Paramètres entreprise & prix de référence enregistrés.');
    } catch {
      onShowToast('Erreur sauvegarde paramètres.');
    }
  };

  const exportAllQuotesJson = () => {
    const allDocs: QuoteDocument[] = index
      .map((e) => {
        try {
          const raw = localStorage.getItem(`${KEY_DOC_PREFIX}${e.id}`);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const payload = {
      format: 'atelier-mobilier-devis-1',
      date: new Date().toISOString(),
      parametres: company,
      tarifsReference: pricing,
      clients,
      devis: allDocs,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-devis-${isoToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`${allDocs.length} devis exportés.`);
  };

  const handleImportQuotesJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed || !Array.isArray(parsed.devis)) {
          onShowToast('Fichier de sauvegarde devis invalide.');
          return;
        }

        const nextIndex = [...index];
        parsed.devis.forEach((rawDoc: any) => {
          const id =
            rawDoc.id ||
            `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const doc: QuoteDocument = {
            id,
            number: rawDoc.number || makeQuoteNumber(),
            statut: rawDoc.statut || 'brouillon',
            date: rawDoc.date || isoToday(),
            validite: rawDoc.validite || addMonthsIso(rawDoc.date || isoToday(), 1),
            auteur: rawDoc.auteur || company.auteur,
            client: rawDoc.client || { nom: '', adr1: '', adr2: '', tel: '', mail: '' },
            description: rawDoc.description || '',
            lignes: Array.isArray(rawDoc.lignes)
              ? rawDoc.lignes.map((l: any) => ({
                  id: l.id || makeLineId(),
                  type: l.type || '',
                  poste: l.poste || '',
                  qte: String(l.qte || ''),
                  pu: String(l.pu || ''),
                  tot: String(l.tot || ''),
                  forcedTotal: Boolean(l.tot),
                }))
              : [],
            tva: rawDoc.tva || '0.21',
            sousTotal: rawDoc.sousTotal || '',
            forcedSousTotal: Boolean(rawDoc.sousTotal),
            remarques: rawDoc.remarques || company.conditions,
            cree: rawDoc.cree || Date.now(),
            maj: rawDoc.maj || Date.now(),
          };
          localStorage.setItem(`${KEY_DOC_PREFIX}${id}`, JSON.stringify(doc));

          const st = doc.lignes.reduce((sum, l) => {
            if (l.tot) return sum + roundMoney(parseNumeric(l.tot));
            if (l.type === 'Compris') return sum;
            return sum + roundMoney(parseNumeric(l.qte) * parseNumeric(l.pu));
          }, 0);
          const sub = doc.sousTotal ? roundMoney(parseNumeric(doc.sousTotal)) : roundMoney(st);
          const tot = roundMoney(sub + sub * vatMultiplier(doc.tva));

          const entry: QuoteIndexEntry = {
            id,
            number: doc.number,
            client: doc.client.nom || '',
            date: doc.date,
            total: tot,
            statut: doc.statut,
            maj: doc.maj || Date.now(),
          };
          const idxPos = nextIndex.findIndex((x) => x.id === id);
          if (idxPos >= 0) nextIndex[idxPos] = entry;
          else nextIndex.push(entry);
        });

        nextIndex.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        localStorage.setItem(KEY_INDEX, JSON.stringify(nextIndex));
        setIndex(nextIndex);

        if (Array.isArray(parsed.clients)) {
          const mergedClients = [...clients];
          parsed.clients.forEach((c: QuoteClient) => {
            const existing = mergedClients.findIndex(
              (x) => x.nom.trim().toLowerCase() === (c.nom || '').trim().toLowerCase()
            );
            if (existing >= 0) mergedClients[existing] = c;
            else if (c.nom) mergedClients.push(c);
          });
          localStorage.setItem(KEY_CLIENTS, JSON.stringify(mergedClients));
          setClients(mergedClients);
        }

        if (parsed.tarifsReference) {
          saveReferencePricing(parsed.tarifsReference);
          setPricing(loadReferencePricing());
        }

        onShowToast(`${parsed.devis.length} devis importés dans l’historique.`);
      } catch {
        onShowToast('Impossible de lire le fichier JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const usedPanelIds = useMemo(() => new Set(allPieces.map((p) => p.mat)), [allPieces]);

  const filteredPanelsForPricing = useMemo(() => {
    const q = panelPriceSearch.trim().toLowerCase();
    return CARLIER_PANELS_CATALOG.filter((panel) => {
      if (panelOnlyProject && !usedPanelIds.has(panel.id)) return false;
      if (!q) return true;
      return `${panel.name} ${panel.code} ${panel.brand} ${panel.category}`
        .toLowerCase()
        .includes(q);
    });
  }, [panelPriceSearch, panelOnlyProject, usedPanelIds]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return index.filter((item) => {
      if (historyStatusFilter !== 'all' && item.statut !== historyStatusFilter) return false;
      if (!q) return true;
      return `${item.number} ${item.client} ${formatDateFr(item.date)}`
        .toLowerCase()
        .includes(q);
    });
  }, [index, historySearch, historyStatusFilter]);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Action & 3D Bridge Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 noprint">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950 p-0.5">
            <button
              onClick={() => setImportMode('sheets')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                importMode === 'sheets'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Au panneau entier
            </button>
            <button
              onClick={() => setImportMode('net_m2')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                importMode === 'net_m2'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Au m² (+15%)
            </button>
          </div>

          <button
            onClick={handleImportFrom3DProject}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chiffrer depuis le projet 3D</span>
          </button>

          {previousSnapshot && (
            <button
              onClick={handleRevertImport}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Annuler l’import</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-400 mr-1">
            {isDirty
              ? 'Modifications non enregistrées'
              : quote.id
              ? `Enregistré · ${quote.number}`
              : 'Nouveau brouillon'}
          </span>

          <button
            onClick={() => {
              setQuote(emptyQuote(company));
              setValiditeManual(false);
              setIsDirty(false);
              setPreviousSnapshot(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Nouveau</span>
          </button>

          <button
            onClick={() => setOpenDrawer('history')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique ({index.length})</span>
          </button>

          <button
            onClick={() => {
              setParamsTab('panels');
              setOpenDrawer('params');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <Tags className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Tarifs réf.</span>
          </button>

          <button
            onClick={() => {
              setParamsTab('company');
              setOpenDrawer('params');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Paramètres</span>
          </button>

          <button
            onClick={saveQuote}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer / PDF</span>
          </button>
        </div>
      </div>

      {/* A4 Printable Sheet Surface */}
      <div className="mx-auto w-full max-w-[920px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-md p-6 sm:p-8 card-print text-slate-900 dark:text-slate-100">
        {/* Document Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-stretch justify-between gap-4 pb-5 border-b border-slate-300 dark:border-slate-700">
          <div className="flex-1 bg-slate-900 dark:bg-slate-950 text-white rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs text-amber-400 font-semibold tracking-wide">
                Devis & Proposition Commerciale
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {company.entreprise}
              </h2>
              <p className="text-xs text-slate-300 mt-1">{company.sousTitre}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-x-4 gap-y-1 font-mono">
              <span>{company.adresse}</span>
              <span>·</span>
              <span>{company.tel}</span>
              <span>·</span>
              <span>{company.mail}</span>
              {company.tvaNum && (
                <>
                  <span>·</span>
                  <span>TVA : {company.tvaNum}</span>
                </>
              )}
            </div>
          </div>

          <div className="w-full sm:w-64 flex flex-col justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Devis n°</span>
              <input
                value={quote.number}
                onChange={(e) => updateQuoteField('number', e.target.value)}
                className="w-32 text-right font-mono font-bold bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-0.5"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Date</span>
              <input
                type="date"
                value={quote.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setQuote((prev) => ({
                    ...prev,
                    date: newDate,
                    validite: validiteManual
                      ? prev.validite
                      : addMonthsIso(newDate, company.validiteMois || 1),
                  }));
                  setIsDirty(true);
                }}
                className="w-32 text-right font-mono bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-0.5"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Validité</span>
              <input
                type="date"
                value={quote.validite}
                onChange={(e) => {
                  setValiditeManual(Boolean(e.target.value));
                  updateQuoteField(
                    'validite',
                    e.target.value || addMonthsIso(quote.date, company.validiteMois || 1)
                  );
                }}
                className="w-32 text-right font-mono bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-0.5"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Auteur</span>
              <input
                value={quote.auteur}
                onChange={(e) => updateQuoteField('auteur', e.target.value)}
                className="w-32 text-right bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-0.5"
              />
            </div>
            <div className="flex items-center justify-between gap-2 noprint">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Statut</span>
              <select
                value={quote.statut}
                onChange={(e) => updateQuoteField('statut', e.target.value as QuoteStatus)}
                className="w-32 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-medium"
              >
                {Object.entries(STATUTS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Client Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Coordonnées Client
            </h3>
            <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-400">Nom / Société :</span>
              <input
                list="devis-clients-list"
                value={quote.client.nom}
                onChange={(e) => handleClientNameChange(e.target.value)}
                placeholder="Nom du client (auto-complété si connu)"
                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-1 font-medium"
              />
              <span className="text-slate-600 dark:text-slate-400">Adresse :</span>
              <input
                value={quote.client.adr1}
                onChange={(e) => {
                  setQuote((prev) => ({
                    ...prev,
                    client: { ...prev.client, adr1: e.target.value },
                  }));
                  setIsDirty(true);
                }}
                placeholder="Rue et numéro"
                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-1"
              />
              <span className="text-slate-600 dark:text-slate-400">CP & Localité :</span>
              <input
                value={quote.client.adr2}
                onChange={(e) => {
                  setQuote((prev) => ({
                    ...prev,
                    client: { ...prev.client, adr2: e.target.value },
                  }));
                  setIsDirty(true);
                }}
                placeholder="Code postal, Ville"
                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-1"
              />
              <span className="text-slate-600 dark:text-slate-400">Téléphone :</span>
              <input
                value={quote.client.tel}
                onChange={(e) => {
                  setQuote((prev) => ({
                    ...prev,
                    client: { ...prev.client, tel: e.target.value },
                  }));
                  setIsDirty(true);
                }}
                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-1 font-mono"
              />
              <span className="text-slate-600 dark:text-slate-400">E-mail :</span>
              <input
                value={quote.client.mail}
                onChange={(e) => {
                  setQuote((prev) => ({
                    ...prev,
                    client: { ...prev.client, mail: e.target.value },
                  }));
                  setIsDirty(true);
                }}
                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-amber-500 outline-none py-1"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Objet & Description des Travaux
            </h3>
            <textarea
              rows={5}
              value={quote.description}
              onChange={(e) => updateQuoteField('description', e.target.value)}
              placeholder="Nature des travaux, localisation, essences/décors retenus, finitions…"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs leading-relaxed focus:border-amber-500 outline-none resize-y"
            />
          </div>
        </div>

        {/* Spreadsheet Lines Table */}
        <div className="py-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 dark:bg-slate-950 text-white">
                  <th className="py-2 px-2.5 text-left font-semibold border border-slate-700 w-24">
                    Type
                  </th>
                  <th className="py-2 px-2.5 text-left font-semibold border border-slate-700">
                    Postes (accepte formules ex: =2,4*3)
                  </th>
                  <th className="py-2 px-2.5 text-right font-semibold border border-slate-700 w-20">
                    Qté
                  </th>
                  <th className="py-2 px-2.5 text-right font-semibold border border-slate-700 w-28">
                    Prix U. HT
                  </th>
                  <th className="py-2 px-2.5 text-right font-semibold border border-slate-700 w-28">
                    Total HT
                  </th>
                  <th className="py-2 px-1.5 w-8 noprint"></th>
                </tr>
              </thead>
              <tbody>
                {quote.lignes.map((line, idx) => {
                  const isEmptyRow =
                    !line.type && !line.poste.trim() && !line.qte.trim() && !line.pu.trim() && !line.tot.trim();
                  const displayTotal = line.forcedTotal
                    ? line.tot
                    : totals.computedLineDisplays[idx];

                  return (
                    <tr
                      key={line.id}
                      className={`border-b border-slate-200 dark:border-slate-800 odd:bg-white dark:odd:bg-slate-900 even:bg-slate-50/70 dark:even:bg-slate-950/40 ${
                        isEmptyRow ? 'hidden print:hidden sm:table-row' : ''
                      }`}
                    >
                      <td className="border-x border-slate-200 dark:border-slate-800 p-0">
                        <select
                          value={line.type}
                          onChange={(e) => updateLine(idx, { type: e.target.value })}
                          className="w-full bg-transparent px-2 py-2 outline-none focus:bg-amber-50 dark:focus:bg-slate-800"
                        >
                          <option value=""></option>
                          {company.unites.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-x border-slate-200 dark:border-slate-800 p-0">
                        <input
                          list="devis-postes-list"
                          value={line.poste}
                          onChange={(e) => updateLine(idx, { poste: e.target.value })}
                          placeholder="Désignation du poste…"
                          className="w-full bg-transparent px-2.5 py-2 outline-none focus:bg-amber-50 dark:focus:bg-slate-800"
                        />
                      </td>
                      <td className="border-x border-slate-200 dark:border-slate-800 p-0">
                        <input
                          value={line.qte}
                          onChange={(e) => updateLine(idx, { qte: e.target.value })}
                          onBlur={() => handleBlurMathField(idx, 'qte', false)}
                          inputMode="decimal"
                          className="w-full text-right font-mono tabular-nums bg-transparent px-2 py-2 outline-none focus:bg-amber-50 dark:focus:bg-slate-800"
                        />
                      </td>
                      <td className="border-x border-slate-200 dark:border-slate-800 p-0">
                        <input
                          value={line.pu}
                          onChange={(e) => updateLine(idx, { pu: e.target.value })}
                          onBlur={() => handleBlurMathField(idx, 'pu', true)}
                          inputMode="decimal"
                          className="w-full text-right font-mono tabular-nums bg-transparent px-2 py-2 outline-none focus:bg-amber-50 dark:focus:bg-slate-800"
                        />
                      </td>
                      <td className="border-x border-slate-200 dark:border-slate-800 p-0">
                        <input
                          value={displayTotal}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateLine(idx, {
                              tot: val,
                              forcedTotal: val.trim() !== '',
                            });
                          }}
                          onBlur={() => {
                            if (line.forcedTotal) handleBlurMathField(idx, 'tot', true);
                          }}
                          className={`w-full text-right font-mono tabular-nums bg-transparent px-2 py-2 outline-none focus:bg-amber-50 dark:focus:bg-slate-800 ${
                            line.forcedTotal ? 'font-bold text-amber-700 dark:text-amber-400' : ''
                          }`}
                        />
                      </td>
                      <td className="text-center p-0 noprint">
                        <button
                          onClick={() => removeLine(idx)}
                          title="Supprimer la ligne"
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3 noprint">
            <button
              onClick={() => addLines(1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-amber-600 dark:border-amber-500 text-amber-800 dark:text-amber-400 text-xs font-medium hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter une ligne</span>
            </button>
            <button
              onClick={() => addLines(5)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-400 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ 5 lignes</span>
            </button>
          </div>
        </div>

        {/* Footer: Remarks & Totals */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Remarques et Conditions
            </h3>
            <textarea
              rows={4}
              value={quote.remarques}
              onChange={(e) => updateQuoteField('remarques', e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs leading-relaxed focus:border-amber-500 outline-none resize-y"
            />
            {company.iban && (
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1">
                Paiement par virement : <b>{company.iban}</b>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_130px] gap-2 items-center text-xs">
              <span className="text-right text-slate-600 dark:text-slate-400">Sous-total HT</span>
              <input
                value={
                  quote.forcedSousTotal ? quote.sousTotal : formatEur(totals.subTotal)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setQuote((prev) => ({
                    ...prev,
                    sousTotal: val,
                    forcedSousTotal: val.trim() !== '',
                  }));
                  setIsDirty(true);
                }}
                onBlur={() => {
                  if (quote.forcedSousTotal) {
                    const v = safeEvaluateMath(quote.sousTotal);
                    if (v !== null) {
                      updateQuoteField('sousTotal', formatEur(roundMoney(v)));
                    }
                  }
                }}
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-right font-mono tabular-nums rounded outline-none focus:border-amber-500"
              />

              <span className="text-right text-slate-600 dark:text-slate-400">Régime TVA</span>
              <select
                value={quote.tva}
                onChange={(e) => updateQuoteField('tva', e.target.value as VatRate)}
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-right rounded outline-none focus:border-amber-500"
              >
                <option value="0.06">6 % (Rénovation BE)</option>
                <option value="0.12">12 %</option>
                <option value="0.21">21 % (Standard)</option>
                <option value="autoliquidation">Autoliquidation (0%)</option>
                <option value="intracommunautaire">Intracom. (0%)</option>
              </select>

              <span className="text-right text-slate-600 dark:text-slate-400">Montant TVA</span>
              <div className="border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5 text-right font-mono tabular-nums rounded">
                {formatEur(totals.vatAmount)}
              </div>

              <span className="text-right font-bold text-slate-900 dark:text-slate-100 text-sm pt-1">
                TOTAL TTC
              </span>
              <div className="border border-amber-500 bg-amber-500/15 text-slate-950 dark:text-amber-300 px-2.5 py-2 text-right font-mono font-bold tabular-nums text-sm rounded">
                {formatEur(totals.grandTotal)}
              </div>
            </div>

            {/* Signature box visible on print */}
            <div className="hidden print:block mt-6 pt-3 border border-slate-400 rounded p-3 text-[10px]">
              <div className="font-bold">Bon pour accord (Date et signature du client) :</div>
              <div className="h-14"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Datalists for Client & Catalogue Autocomplete */}
      <datalist id="devis-clients-list">
        {clients.map((c) => (
          <option key={c.nom} value={c.nom} label={c.adr1 ? `${c.adr1} ${c.adr2}`.trim() : ''} />
        ))}
      </datalist>
      <datalist id="devis-postes-list">
        {company.catalogue.map(([cat, item], idx) => (
          <option key={`${cat}_${idx}`} value={item} label={cat} />
        ))}
      </datalist>

      {/* Slide-over Backdrop */}
      {openDrawer && (
        <div
          onClick={() => setOpenDrawer(null)}
          className="fixed inset-0 bg-slate-950/50 z-50 backdrop-blur-[1px] noprint"
        />
      )}

      {/* History & Backup Drawer */}
      {openDrawer === 'history' && (
        <aside className="fixed top-0 right-0 bottom-0 w-full max-w-md z-50 bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col noprint">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Historique des devis
              </h3>
            </div>
            <button
              onClick={() => setOpenDrawer(null)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Chercher un client, n° de devis…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(['all', 'brouillon', 'envoye', 'accepte', 'refuse'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setHistoryStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors ${
                    historyStatusFilter === st
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {st === 'all' ? 'Tous' : STATUTS[st]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={exportAllQuotesJson}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter JSON</span>
              </button>
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Importer JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportQuotesJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 dark:text-slate-400">
                Aucun devis enregistré pour cette recherche. Cliquez sur « Enregistrer » pour
                archiver votre devis en cours.
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openSavedQuote(item.id)}
                  className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-amber-500 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {item.client || 'Client non renseigné'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.number} · {formatDateFr(item.date)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold tabular-nums text-xs text-slate-900 dark:text-slate-100">
                        {formatEur(item.total)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleQuoteStatus(item.id);
                        }}
                        title="Cliquer pour changer le statut"
                        className={`mt-1 text-[11px] font-semibold ${
                          item.statut === 'accepte'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.statut === 'envoye'
                            ? 'text-sky-600 dark:text-sky-400'
                            : item.statut === 'refuse'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {STATUTS[item.statut]}
                      </button>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => duplicateSavedQuote(item.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] hover:border-amber-500 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Dupliquer</span>
                    </button>

                    {confirmDeleteId === item.id ? (
                      <button
                        onClick={() => deleteSavedQuote(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold"
                      >
                        <Check className="w-3 h-3" />
                        <span>Confirmer</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 text-[11px] hover:border-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Company Settings, Reference Prices & Clients Drawer */}
      {openDrawer === 'params' && (
        <aside className="fixed top-0 right-0 bottom-0 w-full max-w-xl z-50 bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col noprint">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Paramètres & Tarifs de Référence
              </h3>
            </div>
            <button
              onClick={() => setOpenDrawer(null)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Sub-tabs inside Settings Drawer */}
          <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap gap-1.5">
            {[
              { id: 'company', label: 'Entreprise & Marges' },
              { id: 'panels', label: 'Panneaux (€/m²)' },
              { id: 'hardware', label: 'Quincaillerie & Chants' },
              { id: 'catalog', label: 'Catalogue & Clients' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setParamsTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  paramsTab === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-xs">
            {paramsTab === 'company' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Nom de l’entreprise
                  </label>
                  <input
                    value={paramsDraft.entreprise}
                    onChange={(e) =>
                      setParamsDraft((p) => ({ ...p, entreprise: e.target.value }))
                    }
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Activités / Slogan
                  </label>
                  <input
                    value={paramsDraft.sousTitre}
                    onChange={(e) =>
                      setParamsDraft((p) => ({ ...p, sousTitre: e.target.value }))
                    }
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Adresse complète
                  </label>
                  <input
                    value={paramsDraft.adresse}
                    onChange={(e) =>
                      setParamsDraft((p) => ({ ...p, adresse: e.target.value }))
                    }
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Téléphone
                    </label>
                    <input
                      value={paramsDraft.tel}
                      onChange={(e) => setParamsDraft((p) => ({ ...p, tel: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      E-mail
                    </label>
                    <input
                      value={paramsDraft.mail}
                      onChange={(e) => setParamsDraft((p) => ({ ...p, mail: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      N° BCE / TVA
                    </label>
                    <input
                      value={paramsDraft.tvaNum}
                      onChange={(e) =>
                        setParamsDraft((p) => ({ ...p, tvaNum: e.target.value }))
                      }
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      IBAN
                    </label>
                    <input
                      value={paramsDraft.iban}
                      onChange={(e) => setParamsDraft((p) => ({ ...p, iban: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Coef. marge
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      value={paramsDraft.margeCoef}
                      onChange={(e) =>
                        setParamsDraft((p) => ({ ...p, margeCoef: Number(e.target.value) }))
                      }
                      className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Usinage / pce (€)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={paramsDraft.forfaitUsinagePiece}
                      onChange={(e) =>
                        setParamsDraft((p) => ({
                          ...p,
                          forfaitUsinagePiece: Number(e.target.value),
                        }))
                      }
                      className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Pose / h (€)
                    </label>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={paramsDraft.tarifHorairePose}
                      onChange={(e) =>
                        setParamsDraft((p) => ({
                          ...p,
                          tarifHorairePose: Number(e.target.value),
                        }))
                      }
                      className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Auteur par défaut
                    </label>
                    <input
                      value={paramsDraft.auteur}
                      onChange={(e) =>
                        setParamsDraft((p) => ({ ...p, auteur: e.target.value }))
                      }
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Validité (mois)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={paramsDraft.validiteMois}
                      onChange={(e) =>
                        setParamsDraft((p) => ({
                          ...p,
                          validiteMois: Number(e.target.value) || 1,
                        }))
                      }
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Conditions générales par défaut
                  </label>
                  <textarea
                    rows={3}
                    value={paramsDraft.conditions}
                    onChange={(e) =>
                      setParamsDraft((p) => ({ ...p, conditions: e.target.value }))
                    }
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </>
            )}

            {paramsTab === 'panels' && (
              <>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        Remise fournisseur globale sur panneaux non modifiés
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Ex: 15 pour −15 % sur le tarif catalogue (ou −10 pour +10 %).
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="1"
                        min="-100"
                        max="80"
                        value={pricingDraft.panelDiscountPct}
                        onChange={(e) =>
                          setPricingDraft((prev) => ({
                            ...prev,
                            panelDiscountPct: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-right font-mono"
                      />
                      <span className="font-mono text-slate-600 dark:text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={panelPriceSearch}
                      onChange={(e) => setPanelPriceSearch(e.target.value)}
                      placeholder="Filtrer panneau ou code (ex: Egger, MDF)…"
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanelOnlyProject((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      panelOnlyProject
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Projet actif ({usedPanelIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPricingDraft((prev) => ({
                        ...prev,
                        panelPrices: {},
                        panelDiscountPct: 0,
                      }))
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Tout réinit.
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {filteredPanelsForPricing.map((panel) => {
                    const isOverridden = pricingDraft.panelPrices[panel.id] !== undefined;
                    const effective = getEffectivePanelPricePerM2(panel.id, pricingDraft);
                    const isUsed = usedPanelIds.has(panel.id);

                    return (
                      <div
                        key={panel.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-5 h-5 rounded border border-slate-400 dark:border-slate-700 shrink-0"
                            style={{ backgroundColor: panel.colorHex }}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {panel.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {panel.code} · {panel.category} · Défaut : {panel.pricePerM2.toFixed(2)} €
                              {isUsed ? ' · Utilisé' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={effective}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setPricingDraft((prev) => ({
                                ...prev,
                                panelPrices: {
                                  ...prev.panelPrices,
                                  [panel.id]: Number.isFinite(val) ? Math.max(0, val) : 0,
                                },
                              }));
                            }}
                            className={`w-20 px-2 py-1 rounded border text-right font-mono tabular-nums outline-none focus:border-amber-500 ${
                              isOverridden
                                ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                          />
                          <span className="text-[11px] text-slate-500 font-mono">€/m²</span>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() =>
                                setPricingDraft((prev) => {
                                  const next = { ...prev.panelPrices };
                                  delete next[panel.id];
                                  return { ...prev, panelPrices: next };
                                })
                              }
                              title="Revenir au tarif catalogue"
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {paramsTab === 'hardware' && (
              <>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      Placage de chant ABS (prix d’achat référence)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Multiplié par le coefficient de marge lors du chiffrage.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.2"
                      min="0"
                      value={pricingDraft.prixChantMl}
                      onChange={(e) =>
                        setPricingDraft((prev) => ({
                          ...prev,
                          prixChantMl: Math.max(0, parseFloat(e.target.value) || 0),
                        }))
                      }
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-right font-mono tabular-nums"
                    />
                    <span className="font-mono text-slate-500">€/ml</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Tarifs par famille Blum & Lamello P-System
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const def = cloneDefaultPricing();
                      setPricingDraft((prev) => ({
                        ...prev,
                        prixChantMl: def.prixChantMl,
                        hardwarePrices: def.hardwarePrices,
                        hardwareItemOverrides: {},
                      }));
                    }}
                    className="text-[11px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Réinitialiser la grille
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {HARDWARE_PRICE_LABELS.map(({ key, label, unit }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
                    >
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={pricingDraft.hardwarePrices[key as keyof HardwareRefPrices]}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPricingDraft((prev) => ({
                              ...prev,
                              hardwarePrices: {
                                ...prev.hardwarePrices,
                                [key]: Number.isFinite(val) ? Math.max(0, val) : 0,
                              },
                            }));
                          }}
                          className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-right font-mono tabular-nums outline-none focus:border-amber-500"
                        />
                        <span className="text-[11px] text-slate-500 font-mono w-12 text-right">
                          {unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {Object.keys(hardwareSummary).length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    <div className="font-bold text-amber-700 dark:text-amber-400">
                      Surcharge exacte par référence du projet 3D actif
                    </div>
                    {Object.entries(hardwareSummary).map(([itemName, qty]) => {
                      const hasOverride =
                        pricingDraft.hardwareItemOverrides[itemName] !== undefined;
                      const effective = getEffectiveHardwareUnitPrice(itemName, pricingDraft);
                      return (
                        <div
                          key={itemName}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                              {itemName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Qté projet : ×{qty}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={effective}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setPricingDraft((prev) => ({
                                  ...prev,
                                  hardwareItemOverrides: {
                                    ...prev.hardwareItemOverrides,
                                    [itemName]: Number.isFinite(val) ? Math.max(0, val) : 0,
                                  },
                                }));
                              }}
                              className={`w-20 px-2 py-1 rounded border text-right font-mono tabular-nums outline-none focus:border-amber-500 ${
                                hasOverride
                                  ? 'border-amber-500 bg-amber-500/10 font-bold'
                                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                              }`}
                            />
                            <span className="text-[11px] text-slate-500 font-mono">€/u</span>
                            {hasOverride && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPricingDraft((prev) => {
                                    const next = { ...prev.hardwareItemOverrides };
                                    delete next[itemName];
                                    return { ...prev, hardwareItemOverrides: next };
                                  })
                                }
                                title="Revenir au tarif famille"
                                className="p-1 text-slate-400 hover:text-rose-600"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {paramsTab === 'catalog' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Types / Unités (séparés par une virgule)
                  </label>
                  <input
                    value={unitesText}
                    onChange={(e) => setUnitesText(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Catalogue des postes (Catégorie | Poste)
                  </label>
                  <textarea
                    rows={7}
                    value={catalogueText}
                    onChange={(e) => setCatalogueText(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[11px]"
                  />
                </div>

                {/* Saved Clients List */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Base clients enregistrée ({clients.length})</span>
                  </div>
                  {clients.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Chaque devis enregistré mémorise automatiquement les coordonnées du client.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      {clients.map((c, idx) => (
                        <div
                          key={`${c.nom}_${idx}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                        >
                          <span className="truncate">
                            <b>{c.nom}</b>
                            {c.adr2 ? ` · ${c.adr2}` : ''}
                          </span>
                          <button
                            onClick={() => {
                              const next = clients.filter((_, i) => i !== idx);
                              setClients(next);
                              localStorage.setItem(KEY_CLIENTS, JSON.stringify(next));
                            }}
                            className="text-rose-600 dark:text-rose-400 hover:underline shrink-0"
                          >
                            Retirer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={saveCompanySettings}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-colors"
            >
              Enregistrer les paramètres & tarifs de référence
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

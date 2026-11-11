import * as THREE from 'three';
import { MaterialDef, MaterialType } from '../types/furniture';

export const MATERIALS: Record<MaterialType, MaterialDef> = {
  melamine_blanc: {
    id: 'melamine_blanc',
    name: 'Mélaminé Blanc Mat Lisse',
    colorHex: '#f8fafc',
    roughness: 0.35,
    metalness: 0.02,
    woodGrain: false,
    densityKgM3: 680,
    pricePerM2Estimate: 18.5,
  },
  chene_naturel: {
    id: 'chene_naturel',
    name: 'Chêne Clair Naturel (Fil)',
    colorHex: '#d8b98b',
    roughness: 0.65,
    metalness: 0.04,
    woodGrain: true,
    densityKgM3: 720,
    pricePerM2Estimate: 36.0,
  },
  chene_fume: {
    id: 'chene_fume',
    name: 'Chêne Fumé / Teinté Anthracite',
    colorHex: '#473c33',
    roughness: 0.7,
    metalness: 0.05,
    woodGrain: true,
    densityKgM3: 730,
    pricePerM2Estimate: 42.0,
  },
  noyer_canaletto: {
    id: 'noyer_canaletto',
    name: 'Noyer Canaletto Chaleureux',
    colorHex: '#6b4d34',
    roughness: 0.6,
    metalness: 0.05,
    woodGrain: true,
    densityKgM3: 650,
    pricePerM2Estimate: 54.0,
  },
  noir_mat: {
    id: 'noir_mat',
    name: 'Mélaminé Noir Mat Soft-Touch',
    colorHex: '#1e242d',
    roughness: 0.45,
    metalness: 0.05,
    woodGrain: false,
    densityKgM3: 700,
    pricePerM2Estimate: 26.0,
  },
  mdf_brut: {
    id: 'mdf_brut',
    name: 'MDF Standard Brut (Ponçé)',
    colorHex: '#c2a578',
    roughness: 0.85,
    metalness: 0.0,
    woodGrain: false,
    densityKgM3: 750,
    pricePerM2Estimate: 16.0,
  },
  contreplaque_bouleau: {
    id: 'contreplaque_bouleau',
    name: 'Contreplaqué Bouleau Multiplis',
    colorHex: '#e5cfab',
    roughness: 0.75,
    metalness: 0.02,
    woodGrain: true,
    densityKgM3: 680,
    pricePerM2Estimate: 38.0,
  },
  bois_massif: {
    id: 'bois_massif',
    name: 'Bois Massif Chêne Lamellé Collé',
    colorHex: '#c49a65',
    roughness: 0.6,
    metalness: 0.03,
    woodGrain: true,
    densityKgM3: 750,
    pricePerM2Estimate: 85.0,
  },
};

/**
 * Cache for procedurally generated CanvasTextures for realistic wood grain and finishes
 */
const textureCache = new Map<string, THREE.CanvasTexture>();

export function getProceduralTexture(matId: MaterialType): THREE.CanvasTexture | null {
  const mat = MATERIALS[matId] || MATERIALS.melamine_blanc;
  if (!mat.woodGrain) {
    return null;
  }

  if (textureCache.has(matId)) {
    return textureCache.get(matId)!;
  }

  // Generate procedural organic wood grain using HTML5 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base fill
  ctx.fillStyle = mat.colorHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Parse base color components
  const hex = mat.colorHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Subtle natural wood pores and fibers
  const count = 750;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const len = 60 + Math.random() * 220;
    const alpha = 0.04 + Math.random() * 0.12;
    const darker = Math.random() > 0.4;
    const factor = darker ? 0.75 : 1.25;

    ctx.strokeStyle = `rgba(${Math.min(255, Math.floor(r * factor))}, ${Math.min(
      255,
      Math.floor(g * factor)
    )}, ${Math.min(255, Math.floor(b * factor))}, ${alpha})`;
    ctx.lineWidth = 0.8 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 6,
      y + len * 0.33,
      x + (Math.random() - 0.5) * 8,
      y + len * 0.66,
      x + (Math.random() - 0.5) * 5,
      y + len
    );
    ctx.stroke();
  }

  // Soft wood grain waves (anneaux de croissance du bois)
  const rings = 14;
  for (let i = 0; i < rings; i++) {
    const y = (i / rings) * canvas.height + Math.random() * 40;
    const grad = ctx.createLinearGradient(0, y, 0, y + 35);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, canvas.width, 35);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(matId, texture);
  return texture;
}

/**
 * Returns a configured Three.js Material for a given part
 */
export function getThreeMaterial(
  matId: MaterialType,
  isDoorOrFront: boolean = false,
  isBack: boolean = false
): THREE.MeshStandardMaterial {
  const mat = MATERIALS[matId] || MATERIALS.melamine_blanc;
  const texture = getProceduralTexture(matId);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(mat.colorHex),
    roughness: isBack ? 0.85 : mat.roughness,
    metalness: mat.metalness,
    map: texture || null,
    side: THREE.DoubleSide,
  });

  return material;
}

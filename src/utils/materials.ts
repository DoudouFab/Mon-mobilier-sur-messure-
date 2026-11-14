import * as THREE from 'three';

/**
 * Cache for procedurally generated CanvasTextures for realistic wood grain and finishes
 */
const textureCache = new Map<string, THREE.CanvasTexture>();

export function getProceduralTexture(
  colorHex: string,
  woodGrain: boolean
): THREE.CanvasTexture | null {
  if (!woodGrain) {
    return null;
  }

  const cacheKey = `${colorHex}_grain`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const hex = colorHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 180;
  const g = parseInt(hex.substring(2, 4), 16) || 150;
  const b = parseInt(hex.substring(4, 6), 16) || 110;

  // Natural wood pores and fibers
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

  // Soft growth rings
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
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Returns a configured Three.js Material for a given Carlier part
 */
export function getThreeMaterial(
  colorHex: string,
  woodGrain: boolean,
  roughness: number,
  metalness: number,
  isBack: boolean = false
): THREE.MeshStandardMaterial {
  const texture = getProceduralTexture(colorHex, woodGrain);

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: isBack ? Math.max(0.8, roughness) : roughness,
    metalness,
    map: texture || null,
    side: THREE.DoubleSide,
  });
}

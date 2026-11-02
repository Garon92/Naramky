// Physically based bead materials. One material per finish; per-bead colour comes
// from instanceColor. The AO patch darkens image based light where beads touch.
import * as THREE from 'three';

const FINISHES = {
  opaque: { roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.018, ior: 1.52, specularIntensity: 0.55 },
  matte: { roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.5, ior: 1.45, sheen: 0.2, sheenRoughness: 0.8 },
  luster: {
    roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.018, ior: 1.55,
    iridescence: 0.32, iridescenceIOR: 1.6, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 340,
  },
  ab: {
    roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.55,
    iridescence: 0.95, iridescenceIOR: 1.85, iridescenceThicknessMinimum: 220, iridescenceThicknessMaximum: 620,
  },
  metal: { metalness: 1, roughness: 0.2, clearcoat: 0.2, clearcoatRoughness: 0.08 },
  metalMatte: { metalness: 1, roughness: 0.48 },
  // Lined glass: a mirror-like core shows through coloured glass.
  lined: { metalness: 0.55, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52 },
  colorLined: { metalness: 0.08, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.018, ior: 1.52, specularIntensity: 0.55 },
  trans: { metalness: 0.28, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52 },
  silk: { roughness: 0.36, clearcoat: 0.85, clearcoatRoughness: 0.09, sheen: 0.35, sheenRoughness: 0.5 },
  alabaster: { roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12, sheen: 0.55, sheenRoughness: 0.45 },
  steel: { metalness: 1, roughness: 0.24 },
};

const cache = new Map();

// Shared with the render loop so accumulation can rebalance dome light.
export const lightingUniforms = { uIBLDiffuse: { value: 0.4 } };

function patchAO(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uIBLDiffuse = lightingUniforms.uIBLDiffuse;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAO;\nvarying float vAO;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvAO = aAO * mix(0.42, 1.0, smoothstep(-0.45, 0.75, normal.y));'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAO;\nuniform float uIBLDiffuse;')
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= vAO * uIBLDiffuse;
        reflectedLight.indirectSpecular *= mix(0.25, 1.0, vAO);
        #ifdef USE_CLEARCOAT
          clearcoatSpecularIndirect *= mix(0.2, 1.0, vAO);
        #endif`
      );
  };
  material.customProgramCacheKey = () => 'bead-ao';
}

export function beadMaterial(finish) {
  const key = FINISHES[finish] ? finish : 'opaque';
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...FINISHES[key] });
  m.envMapIntensity = 1;
  patchAO(m);
  cache.set(key, m);
  return m;
}

const METALS = {
  steel: { color: 0xc9cbd0, roughness: 0.24 },
  rose: { color: 0xe6b09a, roughness: 0.22 },
  gold: { color: 0xe0b45e, roughness: 0.22 },
  dark: { color: 0x55565c, roughness: 0.3 },
};

export function metalMaterial(kind) {
  const key = `metal:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const spec = METALS[kind] ?? METALS.steel;
  const m = new THREE.MeshPhysicalMaterial({ metalness: 1, ...spec });
  patchAO(m);
  cache.set(key, m);
  return m;
}

export function threadMaterial(color = 0x2a2523) {
  const key = `thread:${color}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  cache.set(key, m);
  return m;
}

// The hex in the directory is a photo mean, shadows included, so the true glass
// colour is lighter than that average. Boost in linear light, per finish.
const BOOST = {
  opaque: 1.32, matte: 1.24, luster: 1.26, ab: 1.22, metal: 2.1, metalMatte: 1.9,
  lined: 1.5, colorLined: 1.34, trans: 1.5, silk: 1.28, alabaster: 1.26,
};

export function albedoFromHex(hex, finish, out = new THREE.Color()) {
  out.set(`#${hex.replace('#', '')}`); // ColorManagement converts sRGB to linear
  const b = BOOST[finish] ?? 1.3;
  const gray = (out.r + out.g + out.b) / 3;
  const sat = finish === 'metal' || finish === 'metalMatte' ? 1 : 1.22;
  out.r = Math.min(1, Math.max(0, gray + (out.r - gray) * sat) * b);
  out.g = Math.min(1, Math.max(0, gray + (out.g - gray) * sat) * b);
  out.b = Math.min(1, Math.max(0, gray + (out.b - gray) * sat) * b);
  return out;
}

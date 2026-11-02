// Physically based bead materials. One material per finish; per-bead colour comes
// from instanceColor. The AO patch darkens image based light where beads touch.
import * as THREE from 'three';
import { CALIBRATION } from './calibration.js';

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
  cord: { roughness: 0.88, sheen: 0.6, sheenRoughness: 0.7 },
  crystal: { metalness: 0.3, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.012, ior: 1.75, iridescence: 0.3, iridescenceIOR: 1.7, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 420 },
};

const cache = new Map();

// Shared with the render loop so accumulation can rebalance dome light.
export const lightingUniforms = { uIBLDiffuse: { value: 1.05 } };

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

// Calibration. The catalogue hex is the mean colour of the maker's photo of a pile of
// beads, so a bead must be painted whatever colour makes our rendered bead surface average
// to that same hex. Each finish has a measured curve: paint value to rendered value, both
// in linear light. tools/calibrate.html measures the curves in calibration.js.
export { CALIBRATION };

function invertCurve(curve, y) {
  const { x: xs, y: ys } = curve;
  if (y <= ys[0]) return xs[0] * (ys[0] > 0 ? y / ys[0] : 0);
  for (let i = 1; i < ys.length; i++) {
    if (y <= ys[i]) return xs[i - 1] + ((xs[i] - xs[i - 1]) * (y - ys[i - 1])) / (ys[i] - ys[i - 1] || 1);
  }
  return xs[xs.length - 1];
}

export function albedoFromHex(hex, finish, out = new THREE.Color()) {
  out.set(`#${hex.replace('#', '')}`); // ColorManagement converts sRGB to linear
  const curve = CALIBRATION[finish];
  if (!curve) return out;
  out.r = invertCurve(curve, out.r);
  out.g = invertCurve(curve, out.g);
  out.b = invertCurve(curve, out.b);
  return out;
}

// Bead meshes in real millimetres. Local axes: X along the bracelet, Y is the band
// normal (up), Z across the bracelet. Delica holes run along Z, strung beads along X.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SHAPES } from '../core/shapes.js';

// Low frequency wobble so reflections are not CAD-perfect. Periodic in theta.
function wobble(theta, h, seed) {
  return (
    Math.sin(theta * 2 + seed * 3.1 + h * 1.7) * 0.5 +
    Math.sin(theta * 3 + seed * 7.3 - h * 2.3) * 0.32 +
    Math.sin(theta * 5 + seed * 1.9 + h * 3.1) * 0.18
  );
}

// Profile points (radius, height) walk from the hole around the outside and back.
function cylinderProfile(R, H, holeR, corner, cornerSteps, wallSteps) {
  const pts = [];
  const push = (r, h, ao) => pts.push({ r, h, ao });
  push(holeR, -H * 0.55, 0.05);
  push(holeR, -H + corner * 0.5, 0.12);
  const rim = corner * 0.5;
  for (let i = 0; i <= 3; i++) {
    const a = Math.PI + (i / 3) * (Math.PI / 2);
    push(holeR + rim + Math.cos(a) * rim, -H + rim + Math.sin(a) * rim, 0.3);
  }
  for (let i = 0; i <= cornerSteps; i++) {
    const a = -Math.PI / 2 + (i / cornerSteps) * (Math.PI / 2);
    push(R - corner + Math.cos(a) * corner, -H + corner + Math.sin(a) * corner, 0.45 + 0.55 * (i / cornerSteps));
  }
  for (let i = 1; i < wallSteps; i++) {
    // A slight barrel keeps highlights from being one straight stripe.
    const t = i / wallSteps;
    const bulge = Math.sin(t * Math.PI) * corner * 0.14;
    push(R + bulge, -H + corner + t * (2 * (H - corner)), 1);
  }
  for (let i = 0; i <= cornerSteps; i++) {
    const a = (i / cornerSteps) * (Math.PI / 2);
    push(R - corner + Math.cos(a) * corner, H - corner + Math.sin(a) * corner, 1 - 0.55 * (i / cornerSteps));
  }
  for (let i = 0; i <= 3; i++) {
    const a = Math.PI / 2 + (i / 3) * (Math.PI / 2);
    push(holeR + rim + Math.cos(a) * rim, H - rim + Math.sin(a) * rim, 0.3);
  }
  push(holeR, H - corner * 0.5, 0.12);
  push(holeR, H * 0.55, 0.05);
  return pts;
}

function latheAroundZ(profile, radial, seed, wobbleAmount) {
  const rings = profile.length;
  const positions = new Float32Array((rings * (radial + 1)) * 3);
  const normals = new Float32Array((rings * (radial + 1)) * 3);
  const ao = new Float32Array(rings * (radial + 1));
  const index = [];
  // Profile normals from neighbouring points, pointing away from the solid.
  const pn = profile.map((p, i) => {
    const a = profile[Math.max(0, i - 1)];
    const b = profile[Math.min(rings - 1, i + 1)];
    const dr = b.r - a.r;
    const dh = b.h - a.h;
    const len = Math.hypot(dr, dh) || 1;
    return { nr: dh / len, nh: -dr / len };
  });
  let v = 0;
  for (let i = 0; i < rings; i++) {
    const p = profile[i];
    const n = pn[i];
    for (let j = 0; j <= radial; j++) {
      const theta = (j / radial) * Math.PI * 2;
      const w = wobble(theta, p.h, seed);
      const r = p.r * (1 + w * wobbleAmount);
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      positions[v * 3] = r * c;
      positions[v * 3 + 1] = r * s;
      positions[v * 3 + 2] = p.h;
      // Tilt the normal with the wobble gradient for wavy highlights.
      const dw = wobble(theta + 0.05, p.h, seed) - w;
      const tangent = (dw / 0.05) * wobbleAmount * 2.2;
      let nx = n.nr * c - tangent * s * n.nr;
      let ny = n.nr * s + tangent * c * n.nr;
      let nz = n.nh;
      const nl = Math.hypot(nx, ny, nz) || 1;
      normals[v * 3] = nx / nl;
      normals[v * 3 + 1] = ny / nl;
      normals[v * 3 + 2] = nz / nl;
      ao[v] = p.ao;
      v++;
    }
  }
  const stride = radial + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j;
      const b = a + stride;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  g.setIndex(index);
  return g;
}

function delica(D, L, variant, quality) {
  const R = D / 2;
  const H = L / 2;
  const radial = quality === 'low' ? 12 : 22;
  const cornerSteps = quality === 'low' ? 2 : 4;
  const wallSteps = quality === 'low' ? 2 : 4;
  const profile = cylinderProfile(R, H, R * 0.46, R * 0.27, cornerSteps, wallSteps);
  return latheAroundZ(profile, radial, variant + 1, 0.012);
}

// Round seed bead: a squashed donut with the hole along X.
function rocaille(D, L, variant, quality) {
  const R = D / 2;
  const H = L / 2;
  const radial = quality === 'low' ? 12 : 20;
  const steps = quality === 'low' ? 7 : 12;
  const holeR = R * 0.42;
  const pts = [{ r: holeR, h: -H * 0.5, ao: 0.08 }];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 - 0.95 + ((Math.PI + 1.9) * i) / steps;
    const cr = (R + holeR) / 2;
    const rr = (R - holeR) / 2;
    const q = i / steps;
    pts.push({
      r: cr + Math.cos(a) * rr * 1.02,
      h: Math.sin(a) * H,
      ao: 0.35 + 0.65 * Math.sin(q * Math.PI),
    });
  }
  pts.push({ r: holeR, h: H * 0.5, ao: 0.08 });
  const g = latheAroundZ(pts, radial, variant + 1, 0.022);
  g.rotateY(Math.PI / 2);
  return g;
}

// True sphere with a drilled hole, for stones and metal accents.
function roundBead(D, variant, quality) {
  const R = D / 2;
  const radial = quality === 'low' ? 16 : 28;
  const steps = quality === 'low' ? 10 : 18;
  const holeR = R * 0.2;
  const cap = Math.asin(holeR / R);
  const pts = [{ r: holeR, h: -R * 0.8, ao: 0.05 }];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + cap + ((Math.PI - 2 * cap) * i) / steps;
    pts.push({ r: R * Math.cos(a), h: R * Math.sin(a), ao: 1 });
  }
  pts.push({ r: holeR, h: R * 0.8, ao: 0.05 });
  const g = latheAroundZ(pts, radial, variant + 1, 0.006);
  g.rotateY(Math.PI / 2);
  return g;
}

// Half Tila and similar flat two-hole tiles. Long axis along X.
function tile(w, h, d, quality) {
  const g = new RoundedBoxGeometry(w, h, d, quality === 'low' ? 2 : 4, Math.min(h, d) * 0.2);
  const count = g.attributes.position.count;
  const ao = new Float32Array(count).fill(1);
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  return g;
}

export const VARIANTS = 3;

const cache = new Map();
export function beadGeometry(shape, variant, quality) {
  const key = `${shape}:${variant}:${quality}`;
  if (cache.has(key)) return cache.get(key);
  const def = SHAPES[shape];
  if (!def) throw new Error(`Neznámý tvar korálku: ${shape}`);
  let g;
  if (def.kind === 'delica') g = delica(def.size[0], def.size[1], variant, quality);
  else if (def.kind === 'rocaille') g = rocaille(def.size[0], def.size[1], variant, quality);
  else if (def.kind === 'round') g = roundBead(def.size[0], variant, quality);
  else g = tile(def.size[0], def.size[2], def.size[1], quality);
  cache.set(key, g);
  return g;
}

// --- Metal findings ---------------------------------------------------------

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function chainLinkGeometry(quality) {
  return cached(`link:${quality}`, () => {
    const g = new THREE.TorusGeometry(0.62, 0.16, quality === 'low' ? 6 : 10, quality === 'low' ? 12 : 22);
    g.scale(1.45, 1, 1);
    return withFlatAO(g);
  });
}

export function jumpRingGeometry(quality) {
  return cached(`ring:${quality}`, () => withFlatAO(new THREE.TorusGeometry(1.25, 0.24, quality === 'low' ? 6 : 10, quality === 'low' ? 14 : 28)));
}

// Lobster clasp: a teardrop claw swept as a tapered tube, plus lever and eye.
export function lobsterGeometry(quality) {
  return cached(`lobster:${quality}`, () => buildLobster(quality));
}

function buildLobster(quality) {
  const seg = quality === 'low' ? 40 : 90;
  const ring = quality === 'low' ? 7 : 12;
  const path = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 - Math.PI / 2 + 0.25;
    const taper = 1 - 0.34 * Math.pow(Math.cos(a / 2 + 0.6), 2);
    path.push(new THREE.Vector3(Math.cos(a) * 3.0 * taper + 3.1, Math.sin(a) * 1.72 * taper, 0));
  }
  const curve = new THREE.CatmullRomCurve3(path, false);
  const tube = new THREE.TubeGeometry(curve, seg, 0.62, ring, false);
  tube.scale(1, 1, 1.25);
  const eye = new THREE.TorusGeometry(0.72, 0.2, 8, 18);
  eye.translate(-0.65, 0, 0);
  const lever = new THREE.CapsuleGeometry(0.34, 2.2, 4, 8);
  lever.rotateZ(1.25);
  lever.translate(4.4, 1.78, 0);
  return withFlatAO(mergeSimple([tube, eye, lever]));
}

function withFlatAO(g) {
  g.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
  return g;
}

function mergeSimple(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let at = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, at * 3);
    nor.set(g.attributes.normal.array, at * 3);
    at += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

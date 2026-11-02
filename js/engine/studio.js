// The photo studio: an HDR environment made of softboxes, and procedural surfaces.
// Reflections of these panels are what makes each bead read as glass.
import * as THREE from 'three';

function panel(scene, intensity, w, h, pos, tint = 0xffffff) {
  const c = new THREE.Color(tint).multiplyScalar(intensity);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  m.position.set(...pos);
  m.lookAt(0, 0, 0);
  scene.add(m);
  return m;
}

function studioScene() {
  const s = new THREE.Scene();
  // Dome with a gentle vertical gradient. Warm bounce from below, cool from above.
  const dome = new THREE.SphereGeometry(50, 32, 24);
  const col = new Float32Array(dome.attributes.position.count * 3);
  const p = dome.attributes.position;
  const top = new THREE.Color(0.46, 0.48, 0.52);
  const mid = new THREE.Color(0.24, 0.24, 0.25);
  const low = new THREE.Color(0.17, 0.155, 0.14);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    if (y > 0) tmp.lerpColors(mid, top, y);
    else tmp.lerpColors(mid, low, Math.min(1, -y * 2));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  dome.setAttribute('color', new THREE.BufferAttribute(col, 3));
  s.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  // Window with crossbars, up and behind the bracelet, close to its midline. Cylinders
  // mirror it in a long glint whether their holes run along or across the band.
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    panel(s, 30, 6.4, 6.4, [-5 + dx * 3.6, 25 + dy * 3.6, -17 + dy * 1.8], 0xfff6ea);
  }
  // A smaller pane in front catches the rounded bead edges.
  panel(s, 14, 8, 5, [-8, 26, 16], 0xfff6ea);
  // Big overhead softbox for the broad sheen.
  panel(s, 1.35, 34, 22, [6, 30, -8], 0xffffff);
  // Thin strip on the right gives a rim on the far side of each bead.
  panel(s, 6, 3, 34, [30, 12, 8], 0xeef3ff);
  // Low front fill so the camera-facing side is not dead.
  panel(s, 1.5, 34, 8, [0, 6, 34], 0xffffff);
  return s;
}

export function makeStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(studioScene(), 0.012, 0.1, 200);
  pmrem.dispose();
  return rt.texture;
}

// --- Procedural surfaces ----------------------------------------------------

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Periodic value noise so the tile repeats without seams.
function periodicNoise(size, cells, rnd) {
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  return (x, y) => {
    const fx = (x / size) * cells;
    const fy = (y / size) * cells;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (a, b) => grid[((a + cells) % cells) + ((b + cells) % cells) * cells];
    const top = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
    const bot = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bot * sy;
  };
}

const SURFACES = {
  linen: {
    label: 'Len', roughness: 0.92, repeatMm: 42, normal: 1.1,
    bake(size, rnd) {
      const threads = 3.2;
      const hx = Array.from({ length: size }, () => rnd());
      const hy = Array.from({ length: size }, () => rnd());
      const slub = periodicNoise(size, 14, rnd);
      const slub2 = periodicNoise(size, 40, rnd);
      return (x, y) => {
        const tx = Math.floor(x / threads);
        const ty = Math.floor(y / threads);
        const over = (tx + ty) % 2 === 0;
        const fx = (x / threads) % 1;
        const fy = (y / threads) % 1;
        const round = over ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI);
        const line = over ? hx[tx % size] : hy[ty % size];
        const h = 0.35 + 0.45 * round + 0.2 * line;
        const tone = 0.93 + 0.1 * (line - 0.5) + 0.1 * (slub(x, y) - 0.5) + 0.06 * (slub2(x, y) - 0.5);
        return { h, r: 0.74 * tone * (0.82 + 0.18 * h), g: 0.71 * tone * (0.82 + 0.18 * h), b: 0.65 * tone * (0.82 + 0.18 * h) };
      };
    },
  },
  backdrop: {
    label: 'Studio', roughness: 0.86, repeatMm: 240, normal: 0.2,
    bake(size, rnd) {
      const a = periodicNoise(size, 6, rnd);
      const b = periodicNoise(size, 90, rnd);
      const c = periodicNoise(size, 260, rnd);
      return (x, y) => {
        const n = 0.92 + 0.025 * (a(x, y) - 0.5) + 0.02 * (b(x, y) - 0.5) + 0.03 * (c(x, y) - 0.5);
        return { h: b(x, y) * 0.5 + c(x, y) * 0.5, r: 0.52 * n, g: 0.505 * n, b: 0.475 * n };
      };
    },
  },
  white: {
    label: 'Bílá', roughness: 0.7, repeatMm: 120, normal: 0.12,
    bake(size, rnd) {
      const b = periodicNoise(size, 160, rnd);
      const c = periodicNoise(size, 40, rnd);
      return (x, y) => {
        const n = 0.97 + 0.02 * (b(x, y) - 0.5) + 0.02 * (c(x, y) - 0.5);
        return { h: b(x, y), r: 0.96 * n, g: 0.955 * n, b: 0.945 * n };
      };
    },
  },
  wood: {
    label: 'Dřevo', roughness: 0.58, repeatMm: 170, normal: 0.7,
    bake(size, rnd) {
      const warp = periodicNoise(size, 5, rnd);
      const fine = periodicNoise(size, 180, rnd);
      const pores = periodicNoise(size, 400, rnd);
      return (x, y) => {
        const w = warp(x, y);
        const ring = 0.5 + 0.5 * Math.sin((y / size) * Math.PI * 2 * 11 + w * 7);
        const streak = fine(x * 0.04, y);
        const pore = pores(x * 0.08, y) > 0.72 ? 0.74 : 1;
        const t = 0.55 + 0.25 * ring + 0.2 * streak;
        return { h: ring * 0.6 + streak * 0.4, r: 0.56 * t * pore, g: 0.38 * t * pore, b: 0.235 * t * pore };
      };
    },
  },
  stone: {
    label: 'Kámen', roughness: 0.74, repeatMm: 110, normal: 1.8,
    bake(size, rnd) {
      const a = periodicNoise(size, 7, rnd);
      const b = periodicNoise(size, 26, rnd);
      const c = periodicNoise(size, 90, rnd);
      const d = periodicNoise(size, 280, rnd);
      const grain = periodicNoise(size, 700, rnd);
      return (x, y) => {
        const n = a(x, y) * 0.3 + b(x, y) * 0.26 + c(x, y) * 0.22 + d(x, y) * 0.12 + grain(x, y) * 0.1;
        const v = Math.pow(n, 1.2);
        return { h: n, r: 0.21 + 0.46 * v, g: 0.16 + 0.34 * v, b: 0.115 + 0.23 * v };
      };
    },
  },
  velvet: {
    label: 'Samet', roughness: 0.95, repeatMm: 90, normal: 0.5,
    bake(size, rnd) {
      const a = periodicNoise(size, 5, rnd);
      const b = periodicNoise(size, 300, rnd);
      return (x, y) => {
        const n = 0.8 + 0.5 * (a(x, y) - 0.5) + 0.3 * (b(x, y) - 0.5);
        return { h: b(x, y), r: 0.052 * n, g: 0.048 * n, b: 0.075 * n };
      };
    },
  },
};

const bakedCache = new Map();

function bakeSurface(id, size) {
  const key = `${id}:${size}`;
  if (bakedCache.has(key)) return bakedCache.get(key);
  const def = SURFACES[id] ?? SURFACES.backdrop;
  const rnd = mulberry(id.length * 977 + 13);
  const fn = def.bake(size, rnd);
  const colorData = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = fn(x, y);
      const i = (x + y * size) * 4;
      colorData[i] = Math.min(255, s.r * 255);
      colorData[i + 1] = Math.min(255, s.g * 255);
      colorData[i + 2] = Math.min(255, s.b * 255);
      colorData[i + 3] = 255;
      height[x + y * size] = s.h;
    }
  }
  const normalData = new Uint8Array(size * size * 4);
  const strength = def.normal;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = height[((x + size - 1) % size) + y * size];
      const hr = height[((x + 1) % size) + y * size];
      const hu = height[x + ((y + size - 1) % size) * size];
      const hd = height[x + ((y + 1) % size) * size];
      const nx = (hl - hr) * strength;
      const ny = (hu - hd) * strength;
      const l = Math.hypot(nx, ny, 1);
      const i = (x + y * size) * 4;
      normalData[i] = ((nx / l) * 0.5 + 0.5) * 255;
      normalData[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      normalData[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      normalData[i + 3] = 255;
    }
  }
  const baked = { colorData, normalData, size, def };
  bakedCache.set(key, baked);
  return baked;
}

export function surfaceMaterial(id, renderer, size = 768) {
  const { colorData, normalData, def } = bakeSurface(id, size);
  const repeat = 1000 / def.repeatMm; // the plane is 1000 mm across per UV unit
  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({ map, normalMap, roughness: def.roughness, metalness: 0, envMapIntensity: 0.34 });
}

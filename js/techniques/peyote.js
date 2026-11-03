// Peyote band sewn from Delica beads. Rows run along the bracelet, beads sit side by
// side in each row, and every other row shifts by half a bead, like bricks in a wall.
// A bead on row r, column c sits at x = c + (r % 2) / 2 beads along the band.
import { SHAPES } from '../core/shapes.js';
import { motifOf, parseMotif, placeMotif } from '../core/motifs.js';
import { pixelOf, placePixels, pixelSize } from '../core/pixels.js';

export const NONE = 255;

export const BEAD_SIZES = {
  15: { shape: 'delica15', label: '15/0 (DBS)', perGram: 350 },
  11: { shape: 'delica11', label: '11/0 (DB)', perGram: 200 },
  10: { shape: 'delica10', label: '10/0 (DBM)', perGram: 108 },
};
export const DEFAULT_SIZE = 15;

const beadX = (r, c) => c + (r % 2) / 2;
// Loom work has no half-bead shift: beads sit in a straight grid.
const gridX = (part, r, c) => (part.params.loom ? c : beadX(r, c));
const plainRoles = (labels) => labels.map((label) => ({ label, group: label }));

// How many beads a pointed end takes from a row, on the left and on the right. On the brick
// lattice half a bead per row follows the natural diagonal of the weave, so the edge runs
// straight and both ends match. On a straight grid one bead per row does the same.
function tipCut(r, { w, n, loom }) {
  const d = Math.abs(r - (w - 1) / 2);
  if (loom) return [Math.floor(d), Math.floor(d)];
  const target = d / 2 - (w % 2 ? 0 : 0.25);
  const shift = (r % 2) / 2;
  return [Math.ceil(target - shift), n - 1 - Math.floor(n - 0.5 - target - shift)];
}

const tipLength = (p) => (p.taper ? Math.max(...tipCut(0, p)) : 0);

function taper(cells, p) {
  const { w, n } = p;
  for (let r = 0; r < w; r++) {
    const [left, right] = tipCut(r, p);
    for (let c = 0; c < left; c++) cells[r * n + c] = NONE;
    for (let c = 0; c < right; c++) cells[r * n + n - 1 - c] = NONE;
  }
}

// --- Pictures along the band ---
// Sewn bands use motifs on the brick lattice, woven ones pixel pictures on the grid. Everything
// else about a row of pictures is the same for both.

export const hasFigures = (p) => p.kind === 'motifs' || p.kind === 'pixels';
export const figureKey = (p) => (p.kind === 'pixels' ? 'items' : 'seq');
export const figuresOf = (p) => p[figureKey(p)];

function sizeOf(p, id) {
  if (p.kind === 'pixels') return pixelSize(id);
  const m = parseMotif(id);
  return { rows: m.rows, cols: m.widthBeads };
}

// What the app calls a picture, and the name of its other parts that have their own colour.
function figureInfo(p, id) {
  if (p.kind === 'pixels') {
    const { label, legend } = pixelOf(id);
    const [plural, ...parts] = Object.values(legend);
    return { name: label, plural, parts };
  }
  const { name, plural } = motifOf(id);
  return { name, plural, parts: parseMotif(id).beads.some((b) => b.center) ? ['Středy'] : [] };
}

// The beads of one picture around a centre given in beads along the band. part is null for
// the picture itself, or the name of its other part.
function beadsOf(p, id, center, w, n) {
  const { rows, cols } = sizeOf(p, id);
  const top = Math.floor((w - rows) / 2);
  if (p.kind === 'pixels') {
    const { legend } = pixelOf(id);
    const mainKey = Object.keys(legend)[0];
    return placePixels(id, Math.round(center - (cols - 1) / 2), top, w, n)
      .map(({ r, c, part }) => ({ r, c, part: part === mainKey ? null : legend[part] }));
  }
  return placeMotif(id, Math.round(2 * center), top, w, n).map(({ r, c, center: mid }) => ({ r, c, part: mid ? 'Středy' : null }));
}

// The band for a picture: one free row above and below the tallest one. Null without pictures.
export function fittedWidth(p) {
  if (!hasFigures(p)) return null;
  const rows = [...figuresOf(p), ...(p.spacer ? [p.spacer] : [])].map((id) => sizeOf(p, id).rows);
  return (rows.length ? Math.max(...rows) + 2 : 11) + 2 * (p.frame ?? 0);
}

// Where the pictures go along the band. The row is always centred, so both margins match:
//   center: a group in the middle, with gaps as asked for, closing up if there is no room
//   spread: the pictures spread over the whole length with equal gaps
//   repeat: as spread, with the row repeated as many times as it fits
// Centres are in beads. overflow says how many beads are missing to fit everything in.
export function placeFigures(p) {
  const ids = figuresOf(p);
  const widths = ids.map((id) => sizeOf(p, id).cols);
  const spacerWidth = p.spacer ? sizeOf(p, p.spacer).cols : 0;
  const room = p.n - 2 * ((p.ends ?? 0) + tipLength(p));
  const mid = (p.n - (p.kind === 'pixels' ? 1 : 0.5)) / 2;
  const sum = widths.reduce((a, b) => a + b, 0);
  const wanted = p.gap ?? 2;
  const layout = p.layout ?? 'center';
  const gapsPerJoint = spacerWidth ? 2 : 1;
  const times = layout === 'repeat' && ids.length
    ? Math.max(1, Math.floor(room / (sum + ids.length * (spacerWidth + gapsPerJoint * wanted))))
    : 1;
  const count = ids.length * times;
  const joints = Math.max(0, count - 1);
  const solid = times * sum + joints * spacerWidth;
  const free = room - solid;
  const gap = layout === 'center'
    ? Math.max(0, Math.min(wanted, joints ? Math.floor(free / (joints * gapsPerJoint)) : wanted))
    : Math.max(0, Math.floor(free / (joints * gapsPerJoint + 1)));
  const used = solid + gap * joints * gapsPerJoint;
  const spots = [];
  const spacers = [];
  let edge = mid - used / 2;
  for (let i = 0; i < count; i++) {
    const index = i % ids.length;
    spots.push({ index, center: edge + widths[index] / 2 });
    edge += widths[index];
    if (i === count - 1) break;
    if (spacerWidth) {
      spacers.push({ index: spacers.length, center: edge + gap + spacerWidth / 2 });
      edge += spacerWidth + gap;
    }
    edge += gap;
  }
  return { spots, spacers, gap, times, margin: (room - used) / 2, overflow: Math.max(0, used - room) };
}

// Beads only sit on lattice positions, so a row can land off centre. This is how many whole
// beads bring its two margins closest. Half a bead is out of reach, it would change the lattice.
function centring(p, ids, spots, w, n) {
  let left = Infinity;
  let right = -Infinity;
  for (const { index, center } of spots) {
    for (const { r, c } of beadsOf(p, ids[index], center, w, n)) {
      const x = c + (p.kind === 'pixels' ? 0 : (r % 2) / 2);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (left === Infinity) return 0;
  return Math.round(((p.kind === 'pixels' ? n - 1 : n - 0.5) - right - left) / 2);
}

// A row of pictures. Each is its own slot, so it can be recoloured alone, and slots sharing
// a group can be recoloured together.
function figures(p, w, n) {
  const cells = new Uint8Array(w * n);
  const ids = figuresOf(p);
  const info = ids.map((id) => figureInfo(p, id));
  const group = new Set(info.map((x) => x.plural)).size > 1 ? 'Motivy' : info[0]?.plural;
  const roles = [{ label: 'Podklad', group: 'Podklad' }];
  info.forEach((x, i) => roles.push({ label: `${x.name} ${i + 1}`, group }));
  const spacerFirst = roles.length;
  const spacerRoles = p.spacer ? Math.max(0, p.layout === 'repeat' ? ids.length : ids.length - 1) : 0;
  for (let i = 0; i < spacerRoles; i++) roles.push({ label: `Mezičlánek ${i + 1}`, group: 'Mezičlánky' });
  const endFirst = roles.length;
  if (p.ends) roles.push({ label: 'Levý konec', group: 'Konce' }, { label: 'Pravý konec', group: 'Konce' });
  const bg2Slot = roles.length;
  if (p.bg2) roles.push({ label: 'Trojúhelníky', group: 'Trojúhelníky' });
  const partSlot = new Map();
  for (const name of info.flatMap((x) => x.parts)) {
    if (partSlot.has(name)) continue;
    partSlot.set(name, roles.length);
    roles.push({ label: name, group: name });
  }
  const frameSlot = roles.length;
  if (p.frame) roles.push({ label: 'Lem', group: 'Lem' });

  const { spots, spacers } = placeFigures(p);
  const nudge = centring(p, ids, spots, w, n);
  const taken = new Set();
  for (const { index, center } of spots) {
    for (const { r, c, part } of beadsOf(p, ids[index], center + nudge, w, n)) {
      cells[r * n + c] = part ? partSlot.get(part) : index + 1;
      taken.add(r * n + c);
    }
  }
  for (const { index, center } of spacers) {
    for (const { r, c } of beadsOf(p, p.spacer, center + nudge, w, n)) {
      cells[r * n + c] = spacerFirst + index % spacerRoles;
      taken.add(r * n + c);
    }
  }
  if (p.bg2) {
    // Triangles rising between the motifs from the lower edge of the band.
    const top = Math.floor(w * 0.4);
    for (let i = 0; i + 1 < spots.length; i++) {
      const mid = (Math.round(2 * spots[i].center) + Math.round(2 * spots[i + 1].center)) / 4 + nudge;
      for (let r = top; r < w; r++) {
        for (let c = 0; c < n; c++) {
          if (Math.abs(beadX(r, c) - mid) <= (r - top + 1) * 0.55 && !taken.has(r * n + c)) cells[r * n + c] = bg2Slot;
        }
      }
    }
  }
  if (p.frame) {
    for (let r = 0; r < w; r++) {
      if (r >= p.frame && r < w - p.frame) continue;
      for (let c = 0; c < n; c++) if (!taken.has(r * n + c)) cells[r * n + c] = frameSlot;
    }
  }
  if (p.ends) {
    // Coloured ends follow the edge of the band, also along a pointed end.
    for (let r = 0; r < w; r++) {
      const [left, right] = p.taper ? tipCut(r, p) : [0, 0];
      for (let e = 0; e < p.ends; e++) {
        cells[r * n + left + e] = endFirst;
        cells[r * n + n - 1 - right - e] = endFirst + 1;
      }
    }
  }
  if (p.taper) taper(cells, p);
  return { cells, roles };
}

const generators = {
  motifs: figures,

  // V shapes along the band.
  chevron(p, w, n) {
    const cells = new Uint8Array(w * n);
    const colors = p.colors ?? 3;
    const band = p.band ?? 3;
    const mid = (w - 1) / 2;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) cells[r * n + c] = Math.floor((beadX(r, c) + Math.abs(r - mid)) / band) % colors;
    }
    if (p.taper) taper(cells, p);
    return { cells, roles: plainRoles(Array.from({ length: colors }, (_, i) => `Barva ${i + 1}`)) };
  },

  // Diagonal stripes, the natural line of the peyote grid.
  diagonal(p, w, n) {
    const cells = new Uint8Array(w * n);
    const colors = p.colors ?? 3;
    const band = p.band ?? 3;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) cells[r * n + c] = Math.floor((beadX(r, c) + r / 2) / band) % colors;
    }
    if (p.taper) taper(cells, p);
    return { cells, roles: plainRoles(Array.from({ length: colors }, (_, i) => `Barva ${i + 1}`)) };
  },

  // Colour fading along the length, dithered like hand-mixed beads.
  ombre(p, w, n) {
    const cells = new Uint8Array(w * n);
    const colors = p.colors ?? 4;
    const mirror = p.mirror ?? true;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        let t = c / (n - 1);
        if (mirror) t = 1 - Math.abs(t * 2 - 1);
        const noise = (Math.sin((r + 1) * 12.9898 + (c + 1) * 78.233) * 43758.5453) % 1;
        const f = t * (colors - 1) + (Math.abs(noise) - 0.5) * (p.dither ?? 0.9);
        cells[r * n + c] = Math.max(0, Math.min(colors - 1, Math.round(f)));
      }
    }
    if (p.taper) taper(cells, p);
    return { cells, roles: plainRoles(Array.from({ length: colors }, (_, i) => `Odstín ${i + 1}`)) };
  },

  // Speckled blend of beads.
  speckle(p, w, n) {
    const cells = new Uint8Array(w * n);
    const weights = p.weights ?? [0.5, 0.3, 0.2];
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        // Runs of two or three beads read as a hand-mixed tweed, not as noise.
        const a = Math.abs((Math.sin(Math.floor(r / 2) * 37.7 + Math.floor(c / 2) * 91.1 + 3.3) * 43758.5453) % 1);
        const b = Math.abs((Math.sin(r * 12.9 + c * 78.2) * 24634.6345) % 1);
        const v = a * 0.62 + b * 0.38;
        let acc = 0;
        let slot = weights.length - 1;
        for (let i = 0; i < weights.length; i++) {
          acc += weights[i];
          if (v < acc) {
            slot = i;
            break;
          }
        }
        cells[r * n + c] = slot;
      }
    }
    if (p.taper) taper(cells, p);
    return { cells, roles: plainRoles(weights.map((_, i) => `Barva ${i + 1}`)) };
  },

  // Argyle: large diamonds with a contrast centre.
  argyle(p, w, n) {
    const cells = new Uint8Array(w * n);
    const period = p.period ?? w;
    const mid = (w - 1) / 2;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        const dx = Math.abs(((beadX(r, c) + period / 2) % period) - period / 2);
        const d = dx + Math.abs(r - mid);
        if (d <= period * 0.24) cells[r * n + c] = 2;
        else if (d <= period * 0.5) cells[r * n + c] = 1;
      }
    }
    if (p.taper) taper(cells, p);
    return { cells, roles: plainRoles(['Podklad', 'Kosočtverce', 'Středy']) };
  },

  // Slanted checks made from short diagonal blocks.
  checks(p, w, n) {
    const cells = new Uint8Array(w * n);
    const block = p.block ?? 3;
    const colors = p.colors ?? 2;
    for (let r = 0; r < w; r++) {
      const a = Math.floor(r / block);
      for (let c = 0; c < n; c++) cells[r * n + c] = (a + Math.floor((beadX(r, c) + r / 2) / block)) % colors;
    }
    if (p.taper) taper(cells, p);
    return { cells, roles: plainRoles(Array.from({ length: colors }, (_, i) => `Barva ${i + 1}`)) };
  },

  // Rows of colour along the band.
  stripes(p, w, n) {
    const cells = new Uint8Array(w * n);
    const layout = p.layout ?? [0, 0, 1, 2, 1, 0, 0];
    for (let r = 0; r < w; r++) {
      const slot = layout[Math.round((r / (w - 1)) * (layout.length - 1))];
      for (let c = 0; c < n; c++) cells[r * n + c] = slot;
    }
    if (p.taper) taper(cells, p);
    const colors = Math.max(...layout) + 1;
    return { cells, roles: plainRoles(Array.from({ length: colors }, (_, i) => `Pruh ${i + 1}`)) };
  },

  // Rolling wave: a band of colour rising and falling along the length.
  wave(p, w, n) {
    const cells = new Uint8Array(w * n);
    const period = p.period ?? 22;
    const thick = p.thick ?? 1.9;
    const mid = (w - 1) / 2;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        const s = Math.sin((beadX(r, c) / period) * Math.PI * 2);
        if (Math.abs(r - mid * (1 + 0.72 * s)) < thick) cells[r * n + c] = 1;
        else if (p.double && Math.abs(r - mid * (1 - 0.72 * s)) < thick) cells[r * n + c] = 2;
      }
    }
    if (p.taper) taper(cells, p);
    const labels = ['Podklad', 'Vlna'];
    if (p.double) labels.push('Druhá vlna');
    return { cells, roles: plainRoles(labels) };
  },
};

// --- Loom patterns, in a straight grid ---

Object.assign(generators, {
  pixels: figures,

  // Plaid: crossing bands of colour. Where they meet, the darker one wins every other bead.
  tartan(p, w, n) {
    const cells = new Uint8Array(w * n);
    const rowBands = p.rowBands ?? [0, 0, 1, 1, 0, 0, 2, 0, 0, 1, 1, 0, 0];
    const colBands = p.colBands ?? [0, 0, 0, 1, 1, 0, 0, 0, 2];
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        const a = rowBands[r % rowBands.length];
        const b = colBands[c % colBands.length];
        cells[r * n + c] = a && b ? ((r + c) % 2 ? a : b) : a || b;
      }
    }
    return { cells, roles: plainRoles(['Podklad', 'Pruh', 'Linka']) };
  },

  // Aztec: stepped diamonds nested inside each other.
  aztec(p, w, n) {
    const cells = new Uint8Array(w * n);
    const period = p.period ?? 16;
    const mid = (w - 1) / 2;
    const layers = p.layers ?? 4;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        const dx = Math.abs(((c + period / 2) % period) - period / 2);
        const d = Math.floor((dx + Math.abs(r - mid)) / 2);
        cells[r * n + c] = d < layers ? d + 1 : 0;
      }
    }
    return { cells, roles: plainRoles(['Podklad', 'Střed', 'První lem', 'Druhý lem', 'Třetí lem'].slice(0, layers + 1)) };
  },

  // Ikat: soft zigzags with feathered edges, as if the dye had run.
  ikat(p, w, n) {
    const cells = new Uint8Array(w * n);
    const colors = p.colors ?? 3;
    const band = p.band ?? 5;
    const period = p.period ?? 18;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        const zig = Math.abs(((c % period) / period) * 2 - 1) * (w - 1);
        const noise = Math.abs(Math.sin(r * 91.7 + c * 12.3) * 43758.5453) % 1;
        cells[r * n + c] = Math.floor((r + zig + (noise - 0.5) * 2.2 + w) / band) % colors;
      }
    }
    return { cells, roles: plainRoles(Array.from({ length: colors }, (_, i) => `Barva ${i + 1}`)) };
  },

  // A little landscape: evening sky, sun and hills along the whole band.
  landscape(p, w, n) {
    const cells = new Uint8Array(w * n);
    const sunC = n / 2;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) {
        const sky = Math.min(2, Math.floor((r / (w * 0.72)) * 3));
        const noise = Math.abs(Math.sin(r * 33.1 + c * 7.7) * 9731.3) % 1;
        let slot = noise < 0.16 ? Math.max(0, sky - 1) : sky;
        if (Math.hypot(c - sunC, (r - w * 0.42) * 1.15) < 3.6) slot = 3;
        const hill = w * 0.62 + Math.sin(c * 0.21) * 1.5 + Math.sin(c * 0.09 + 1.2) * 1.2;
        const far = w * 0.72 + Math.sin(c * 0.33 + 2) * 1.2;
        if (r >= far) slot = 5;
        else if (r >= hill) slot = 4;
        cells[r * n + c] = slot;
      }
    }
    return { cells, roles: plainRoles(['Obloha nahoře', 'Obloha uprostřed', 'Obloha u obzoru', 'Slunce', 'Vzdálené kopce', 'Blízké kopce']) };
  },
});

export const GENERATORS = Object.keys(generators);

// Shortest band that still shows the whole row of motifs, for gallery cards.
export function compactColumns(p) {
  const ids = figuresOf(p);
  const gap = p.gap ?? 2;
  const spacer = p.spacer ? sizeOf(p, p.spacer).cols + gap : 0;
  const pictures = ids.reduce((sum, id) => sum + sizeOf(p, id).cols, 0) + (gap + spacer) * Math.max(0, ids.length - 1);
  return Math.max(26, pictures + 4 + (p.ends ?? 0) * 2);
}

export function generate(params) {
  const { kind, w, n } = params;
  const gen = generators[kind];
  if (!gen) throw new Error(`Neznámý vzor: ${kind}`);
  return gen(params, w, n);
}

// --- Technique interface ---------------------------------------------------

export function grid(part) {
  const { w, n } = part.params;
  return { w, n, cells: part.cells ?? generate(part.params).cells };
}

export function beadDims(part) {
  const def = BEAD_SIZES[part.params.size ?? DEFAULT_SIZE];
  const [D, L] = SHAPES[def.shape].size;
  return { D, L, shape: def.shape, perGram: def.perGram, label: def.label };
}

// Real size in millimetres. Along the band a bead takes its diameter, across its length.
export function bandSize(part) {
  const { D, L } = beadDims(part);
  const { w, n, loom } = part.params;
  return { width: w * L, length: (n + (loom ? 0 : 0.5)) * D };
}

export function build(part) {
  const { w, n, cells } = grid(part);
  const { D, L, shape } = beadDims(part);
  const instances = [];
  for (let r = 0; r < w; r++) {
    for (let c = 0; c < n; c++) {
      const slot = cells[r * n + c];
      if (slot === NONE) continue;
      instances.push({
        shape, slot,
        s: (gridX(part, r, c) - (part.params.loom ? n - 1 : n - 0.5) / 2) * D,
        t: (r - (w - 1) / 2) * L,
        row: r, col: c,
      });
    }
  }
  const { width, length } = bandSize(part);
  // The thread layer stays inside the zigzag ends, or it would peek out between rows.
  const inset = D * 0.6 + tipLength(part.params) * D;
  return {
    instances, length, width,
    bed: { sMin: -length / 2 + inset, sMax: length / 2 - inset, tMin: -width / 2 + L * 0.2, tMax: width / 2 - L * 0.2 },
  };
}

export function counts(part) {
  const { cells } = grid(part);
  const { shape, perGram, label } = beadDims(part);
  const map = new Map();
  for (const slot of cells) if (slot !== NONE) map.set(slot, (map.get(slot) ?? 0) + 1);
  return [...map.entries()].map(([slot, count]) => ({ slot, count, shape, perGram, material: `Delica ${label}` }));
}

// Real thread order. Passes go back and forth across the band. The first string lays
// the first two passes together, then each pass adds every other bead.
export function threadPasses(part) {
  const { w, n, cells } = grid(part);
  const passes = [];
  if (part.params.loom) {
    for (let c = 0; c < n; c++) {
      const list = [];
      for (let r = 0; r < w; r++) if (cells[r * n + c] !== NONE) list.push(cells[r * n + c]);
      passes.push({ label: `${c + 1}. řada`, dir: '→', slots: list });
    }
    return passes;
  }
  const rowsOf = (parity) => {
    const list = [];
    for (let r = 0; r < w; r++) if (r % 2 === parity) list.push(r);
    return list;
  };
  const first = [];
  for (let r = 0; r < w; r++) first.push(cells[r * n]);
  passes.push({ label: '1. a 2. řada', dir: '→', slots: first.filter((s) => s !== NONE) });
  let forward = false;
  let number = 3;
  for (let c = 1; c < n; c++) {
    for (const parity of [0, 1]) {
      const list = rowsOf(parity).map((r) => cells[r * n + c]).filter((s) => s !== NONE);
      if (!forward) list.reverse();
      passes.push({ label: `${number}. řada`, dir: forward ? '→' : '←', slots: list });
      forward = !forward;
      number++;
    }
  }
  return passes;
}

export const runLength = (slots) => {
  const out = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && last.slot === s) last.count++;
    else out.push({ slot: s, count: 1 });
  }
  return out;
};

export const steps = (part) => {
  const { w } = part.params;
  if (part.params.loom) {
    return [
      `Technika: tkaní na stavu, ${w} korálků v každé řadě, takže osnova má ${w + 1} nití.`,
      'Na útkovou nit navlékni korálky řady podle postupu, přilož je mezi osnovní nitě a provleč nit zpět nad osnovou.',
      'Pokračuj řadu po řadě. Místo stavu jde šít i čtvercovým stehem, korálky pak leží stejně.',
      'Na konci zapošij osnovní nitě zpět do řad a přidej komponenty.',
    ];
  }
  const even = w % 2 === 0;
  return [
    `Technika: plochý peyote, ${w} korálků na šířku (${even ? 'sudý počet, even-count' : 'lichý počet, odd-count'}).`,
    'Navlékni první řádek a pak pracuj tam a zpět: nasaď korálek, přeskoč jeden a projdi dalším.',
    even
      ? 'Při sudém počtu se na konci řady jen otočíš a pokračuješ dál.'
      : 'Při lichém počtu se na jedné straně musí udělat obrat provlečením zpět přes předchozí řady.',
    'Na konci provleč nit zpět vzorem a zakonči ji uzlíkem, pak přidej komponenty a řetízek.',
  ];
};

// --- Editing helpers --------------------------------------------------------

export function ensureCells(part) {
  if (!part.cells) part.cells = generate(part.params).cells.slice();
  return part.cells;
}

export function floodFill(cells, w, n, r0, c0, slot, loom = false) {
  const from = cells[r0 * n + c0];
  if (from === slot || from === NONE) return 0;
  const stack = [[r0, c0]];
  let changed = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    if (r < 0 || r >= w || c < 0 || c >= n || cells[r * n + c] !== from) continue;
    cells[r * n + c] = slot;
    changed++;
    stack.push([r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c]);
    // Peyote rows interlock, so each bead touches two beads above and two below.
    const side = r % 2 ? 1 : -1;
    if (!loom) stack.push([r - 1, c + side], [r + 1, c + side]);
  }
  return changed;
}

export function mirrorCell(r, c, w, n, mirrorX, mirrorY, loom = false) {
  const out = [[r, c]];
  if (loom) {
    if (mirrorX) out.push([r, n - 1 - c]);
    if (mirrorY) out.push([w - 1 - r, c]);
    if (mirrorX && mirrorY) out.push([w - 1 - r, n - 1 - c]);
    return out;
  }
  // Mirroring along the length keeps the row shift only around a bead-centred axis.
  const mx = (rr, cc) => [rr, n - 1 - cc - (rr % 2)];
  // Mirroring across the width swaps rows, adjusting for the shift when parity changes.
  const my = (rr, cc) => {
    const r2 = w - 1 - rr;
    if (r2 % 2 === rr % 2) return [r2, cc];
    return [r2, rr % 2 ? cc + 1 : cc];
  };
  if (mirrorX) out.push(mx(r, c));
  if (mirrorY) out.push(my(r, c));
  if (mirrorX && mirrorY) out.push(my(...mx(r, c)));
  return out.filter(([rr, cc]) => rr >= 0 && rr < w && cc >= 0 && cc < n);
}

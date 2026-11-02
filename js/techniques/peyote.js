// Peyote band sewn from Delica beads. Rows run along the bracelet, beads sit side by
// side in each row, and every other row shifts by half a bead, like bricks in a wall.
// A bead on row r, column c sits at x = c + (r % 2) / 2 beads along the band.
import { SHAPES } from '../core/shapes.js';
import { parseMotif, placeMotif } from '../core/motifs.js';

export const NONE = 255;

export const BEAD_SIZES = {
  15: { shape: 'delica15', label: '15/0 (DBS)', perGram: 350 },
  11: { shape: 'delica11', label: '11/0 (DB)', perGram: 200 },
  10: { shape: 'delica10', label: '10/0 (DBM)', perGram: 108 },
};
export const DEFAULT_SIZE = 15;

const beadX = (r, c) => c + (r % 2) / 2;
const plainRoles = (labels) => labels.map((label) => ({ label, group: label }));

function taper(cells, w, n) {
  // Rows drop away towards the clasp, leaving a point at each end like a hand-made tab.
  const mid = (w - 1) / 2;
  for (let r = 0; r < w; r++) {
    const cut = Math.round(Math.abs(r - mid) * 0.75);
    for (let c = 0; c < cut; c++) {
      cells[r * n + c] = NONE;
      cells[r * n + n - 1 - c] = NONE;
    }
  }
}

const generators = {
  // A row of motifs. Every motif, spacer and end is its own slot, so each can be
  // recoloured alone, and slots sharing a group can be recoloured together.
  motifs(p, w, n) {
    const cells = new Uint8Array(w * n);
    const seq = p.seq;
    const k = seq.length;
    const motifLabel = p.motifLabel ?? 'Motiv';
    const motifGroup = p.motifGroup ?? `${motifLabel}y`;
    const roles = [{ label: 'Podklad', group: 'Podklad' }];
    seq.forEach((_, i) => roles.push({ label: `${motifLabel} ${i + 1}`, group: motifGroup }));
    const spacerFirst = roles.length;
    if (p.spacer) {
      for (let i = 0; i < k - 1; i++) roles.push({ label: `Mezičlánek ${i + 1}`, group: 'Mezičlánky' });
    }
    const endFirst = roles.length;
    if (p.ends) {
      roles.push({ label: 'Levý konec', group: 'Konce' }, { label: 'Pravý konec', group: 'Konce' });
    }
    const bg2Slot = roles.length;
    if (p.bg2) roles.push({ label: 'Trojúhelníky', group: 'Trojúhelníky' });

    const parsedSeq = seq.map((id) => parseMotif(id));
    const spacer = p.spacer ? parseMotif(p.spacer) : null;
    const gap = p.gap ?? 2;
    const between = gap + (spacer ? spacer.widthBeads + gap : 0);
    const total = parsedSeq.reduce((sum, m) => sum + m.widthBeads, 0) + between * (k - 1);
    // Positions in half beads, so motifs stay centred whatever the band length.
    let x = n - 0.5 - total + parsedSeq[0].widthBeads;
    const centers = [];
    parsedSeq.forEach((m, i) => {
      centers.push(Math.round(x));
      if (i < k - 1) x += m.widthBeads + parsedSeq[i + 1].widthBeads + between * 2;
    });

    const topFor = (m) => Math.floor((w - m.rows) / 2);
    const motifCells = new Set();
    parsedSeq.forEach((m, i) => {
      for (const { r, c } of placeMotif(seq[i], centers[i], topFor(m), w, n)) {
        cells[r * n + c] = i + 1;
        motifCells.add(r * n + c);
      }
    });
    if (spacer) {
      for (let i = 0; i < k - 1; i++) {
        const cx = Math.round((centers[i] + centers[i + 1]) / 2);
        for (const { r, c } of placeMotif(p.spacer, cx, topFor(spacer), w, n)) {
          cells[r * n + c] = spacerFirst + i;
          motifCells.add(r * n + c);
        }
      }
    }
    if (p.bg2) {
      // Triangles rising between the motifs from the lower edge of the band.
      const top = Math.floor(w * 0.4);
      for (let i = 0; i < k - 1; i++) {
        const mid = (centers[i] + centers[i + 1]) / 4;
        for (let r = top; r < w; r++) {
          for (let c = 0; c < n; c++) {
            if (Math.abs(beadX(r, c) - mid) <= (r - top + 1) * 0.55 && !motifCells.has(r * n + c)) cells[r * n + c] = bg2Slot;
          }
        }
      }
    }
    if (p.ends) {
      for (let r = 0; r < w; r++) {
        for (let e = 0; e < p.ends; e++) {
          cells[r * n + e] = endFirst;
          cells[r * n + n - 1 - e] = endFirst + 1;
        }
      }
    }
    if (p.taper) taper(cells, w, n);
    return { cells, roles };
  },

  // V shapes along the band.
  chevron(p, w, n) {
    const cells = new Uint8Array(w * n);
    const colors = p.colors ?? 3;
    const band = p.band ?? 3;
    const mid = (w - 1) / 2;
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) cells[r * n + c] = Math.floor((beadX(r, c) + Math.abs(r - mid)) / band) % colors;
    }
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
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
    if (p.taper) taper(cells, w, n);
    const labels = ['Podklad', 'Vlna'];
    if (p.double) labels.push('Druhá vlna');
    return { cells, roles: plainRoles(labels) };
  },
};

export const GENERATORS = Object.keys(generators);

// Shortest band that still shows the whole row of motifs, for gallery cards.
export function compactColumns(p) {
  const widths = p.seq.map((id) => parseMotif(id).widthBeads);
  const spacer = p.spacer ? parseMotif(p.spacer).widthBeads + (p.gap ?? 2) : 0;
  const motifs = widths.reduce((a, b) => a + b, 0) + ((p.gap ?? 2) + spacer) * (widths.length - 1);
  return Math.max(26, motifs + 4 + (p.ends ?? 0) * 2);
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
  const { w, n } = part.params;
  return { width: w * L, length: (n + 0.5) * D };
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
        s: (beadX(r, c) - (n - 0.5) / 2) * D,
        t: (r - (w - 1) / 2) * L,
        row: r, col: c,
      });
    }
  }
  const { width, length } = bandSize(part);
  // The thread layer stays inside the zigzag ends, or it would peek out between rows.
  const inset = D * 0.6 + (part.params.taper ? Math.round(((w - 1) / 2) * 0.75) * D : 0);
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

export function floodFill(cells, w, n, r0, c0, slot) {
  const from = cells[r0 * n + c0];
  if (from === slot || from === NONE) return 0;
  const stack = [[r0, c0]];
  let changed = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    if (r < 0 || r >= w || c < 0 || c >= n || cells[r * n + c] !== from) continue;
    cells[r * n + c] = slot;
    changed++;
    // Rows interlock, so each bead touches two beads above and two below.
    const side = r % 2 ? 1 : -1;
    stack.push([r, c - 1], [r, c + 1]);
    stack.push([r - 1, c], [r - 1, c + side], [r + 1, c], [r + 1, c + side]);
  }
  return changed;
}

export function mirrorCell(r, c, w, n, mirrorX, mirrorY) {
  const out = [[r, c]];
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

// Motifs drawn as text, so a shape can be read right here. Each line is a row along
// the bracelet. Beads sit on every other character, and each next line shifts by one
// character, exactly as peyote rows shift by half a bead. # is the motif, o its centre,
// which has a colour of its own. name and plural are what a picture is called in the app.
import { isDrawn, decodeDrawn } from './drawn.js';

const HEART = { name: 'Srdíčko', plural: 'Srdíčka' };

export const MOTIFS = {
  // Hearts as in the reference images: two round lobes, a clear notch, then straight
  // sides that lose half a bead per row down to a single bead at the tip.
  heartS: {
    ...HEART,
    label: 'Srdce malé',
    art: [
      '  #   #',
      ' # # # #',
      '# # # # #',
      ' # # # #',
      '  # # #',
      '   # #',
      '    #',
    ],
  },
  heartN: {
    ...HEART,
    label: 'Srdce',
    art: [
      '  # #   # #',
      ' # # # # # #',
      '# # # # # # #',
      ' # # # # # #',
      '  # # # # #',
      '   # # # #',
      '    # # #',
      '     # #',
      '      #',
    ],
  },
  heartM: {
    ...HEART,
    label: 'Srdce větší',
    art: [
      '  # #     # #',
      ' # # #   # # #',
      '# # # # # # # #',
      ' # # # # # # #',
      '  # # # # # #',
      '   # # # # #',
      '    # # # #',
      '     # # #',
      '      # #',
      '       #',
    ],
  },
  heartL: {
    ...HEART,
    label: 'Srdce velké',
    art: [
      '   # #       # #',
      '  # # #     # # #',
      ' # # # #   # # # #',
      '# # # # # # # # # #',
      ' # # # # # # # # #',
      '  # # # # # # # #',
      '   # # # # # # #',
      '    # # # # # #',
      '     # # # # #',
      '      # # # #',
      '       # # #',
      '        # #',
      '         #',
    ],
  },
  dot: { label: 'Malý křížek', name: 'Křížek', plural: 'Křížky', art: [' # #', '# # #', ' # #'] },
  cross: { label: 'Velký křížek', name: 'Křížek', plural: 'Křížky', art: ['  #', ' # #', '# # #', ' # #', '  #'] },
  diamond: {
    label: 'Kosočtverec', name: 'Kosočtverec', plural: 'Kosočtverce',
    art: ['    #', '   # #', '  # # #', ' # # # #', '# # # # #', ' # # # #', '  # # #', '   # #', '    #'],
  },
  star: {
    label: 'Hvězda', name: 'Hvězda', plural: 'Hvězdy',
    art: [
      '      # #',
      '     # # #',
      '# # # # # # # #',
      ' # # # # # # #',
      '  # # # # # #',
      '   # # # # #',
      '  # # # # # #',
      ' # # #   # # #',
      '# #         # #',
    ],
  },
  flower: {
    label: 'Květina', name: 'Květina', plural: 'Květiny',
    art: [
      '    # #   # #',
      '   # # # # # #',
      '    # # # # #',
      ' # # # o o # # #',
      '# # # o o o # # #',
      ' # # # o o # # #',
      '    # # # # #',
      '   # # # # # #',
      '    # #   # #',
    ],
  },
  clover: {
    label: 'Čtyřlístek', name: 'Čtyřlístek', plural: 'Čtyřlístky',
    art: [
      '  # #   # #',
      ' # # # # # #',
      '  # # # # #',
      '     # #',
      '  # # # # #',
      ' # # # # # #',
      '  # #   # #',
    ],
  },
  moon: {
    label: 'Měsíc', name: 'Měsíc', plural: 'Měsíce',
    art: [
      '      # # #',
      '   # # # #',
      '  # # # #',
      ' # # # #',
      '  # # #',
      ' # # # #',
      '  # # # #',
      '   # # # #',
      '      # # #',
    ],
  },
  butterfly: {
    label: 'Motýl', name: 'Motýl', plural: 'Motýli',
    art: [
      '# # #   o   # # #',
      ' # # # o o # # #',
      '  # # # o # # #',
      '   # # o o # #',
      '    # # o # #',
      '   # # o o # #',
      '  # # # o # # #',
      '   # # o o # #',
      '    #   o   #',
    ],
  },
  cat: {
    label: 'Kočička', name: 'Kočička', plural: 'Kočičky',
    art: [
      '#           #',
      ' # #     # #',
      '# # # # # # #',
      ' # # # # # #',
      '# # o # o # #',
      ' # # # # # #',
      '# # # # # # #',
      ' # # # # # #',
      '  # # # # #',
    ],
  },
  smile: {
    label: 'Smajlík', name: 'Smajlík', plural: 'Smajlíci',
    art: [
      '   # # # #',
      '  # # # # #',
      ' # # o # o #',
      '# # # # # # #',
      ' # # # # # #',
      '# o # # # o #',
      ' # o o o o #',
      '  # # # # #',
      '   # # # #',
    ],
  },
};

const DRAWN_NAMES = { label: 'Vlastní tvar', name: 'Motiv', plural: 'Motivy' };

export const motifOf = (id) => MOTIFS[id] ?? (isDrawn(id) ? { ...DRAWN_NAMES, art: decodeDrawn(id) } : null);

const parsed = new Map();

// Returns beads as { row, x } where x is in half-bead units relative to the axis.
export function parseMotif(id) {
  if (parsed.has(id)) return parsed.get(id);
  const art = motifOf(id).art;
  let min = Infinity;
  let max = -Infinity;
  const raw = [];
  art.forEach((line, row) => {
    for (let p = 0; p < line.length; p++) {
      if (line[p] !== ' ') {
        raw.push({ row, p, center: line[p] === 'o' });
        min = Math.min(min, p);
        max = Math.max(max, p);
      }
    }
  });
  const axis = Math.round((min + max) / 2);
  const beads = raw.map((b) => ({ row: b.row, x: b.p - axis, center: b.center }));
  const m = { beads, rows: art.length, widthBeads: Math.ceil((max - min) / 2) + 1 };
  parsed.set(id, m);
  return m;
}

// Places a motif with its axis at half-bead position X and its top on topRow. A bead
// on row r sits at X = 2c + (r % 2), so if the rows do not line up it moves half a bead.
export function placeMotif(id, X, topRow, w, n) {
  const m = parseMotif(id);
  const first = m.beads[0];
  const r0 = topRow + first.row;
  const wanted = ((r0 % 2) + 2) % 2;
  const have = (((X + first.x) % 2) + 2) % 2;
  const fixedX = have === wanted ? X : X + 1;
  const out = [];
  for (const b of m.beads) {
    const r = topRow + b.row;
    if (r < 0 || r >= w) continue;
    const c = (fixedX + b.x - (r % 2)) / 2;
    if (c >= 0 && c < n) out.push({ r, c, center: b.center });
  }
  return out;
}

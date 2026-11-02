// Motifs drawn as text, so a shape can be read right here. Each line is a row along
// the bracelet. Beads sit on every other character, and each next line shifts by one
// character, exactly as peyote rows shift by half a bead.
export const MOTIFS = {
  // Hearts as in the reference images: two round lobes, a clear notch, then straight
  // sides that lose half a bead per row down to a single bead at the tip.
  heartS: {
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
  dot: { label: 'Zlatý křížek', art: [' # #', '# # #', ' # #'] },
  cross: { label: 'Velký křížek', art: ['  #', ' # #', '# # #', ' # #', '  #'] },
  diamond: {
    label: 'Kosočtverec',
    art: ['    #', '   # #', '  # # #', ' # # # #', '# # # # #', ' # # # #', '  # # #', '   # #', '    #'],
  },
  star: {
    label: 'Hvězda',
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
    label: 'Květina',
    art: [
      '    # # #',
      '   # # # #',
      '# # # # # # #',
      ' # # # # # #',
      '# # # # # # #',
      '   # # # #',
      '    # # #',
    ],
  },
  clover: {
    label: 'Čtyřlístek',
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
};

const parsed = new Map();

// Returns beads as { row, x } where x is in half-bead units relative to the axis.
export function parseMotif(id) {
  if (parsed.has(id)) return parsed.get(id);
  const art = MOTIFS[id].art;
  let min = Infinity;
  let max = -Infinity;
  const raw = [];
  art.forEach((line, row) => {
    for (let p = 0; p < line.length; p++) {
      if (line[p] === '#') {
        raw.push({ row, p });
        min = Math.min(min, p);
        max = Math.max(max, p);
      }
    }
  });
  const axis = Math.round((min + max) / 2);
  const beads = raw.map((b) => ({ row: b.row, x: b.p - axis }));
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
    if (c >= 0 && c < n) out.push({ r, c });
  }
  return out;
}

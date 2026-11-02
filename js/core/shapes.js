// Bead shapes with their real sizes in millimetres: diameter, then length along the hole.
// Tiles list width, depth and thickness. A shape's own finish overrides the colour's.
export const SHAPES = {
  delica15: { size: [1.3, 1.15], kind: 'delica', label: 'Delica 15/0 (DBS)', perGram: 350 },
  delica11: { size: [1.6, 1.3], kind: 'delica', label: 'Delica 11/0 (DB)', perGram: 200 },
  delica10: { size: [2.2, 1.7], kind: 'delica', label: 'Delica 10/0 (DBM)', perGram: 108 },
  rocaille15: { size: [1.5, 1.0], kind: 'rocaille', label: 'Rokajl 15/0', perGram: 250 },
  rocaille11: { size: [2.2, 1.45], kind: 'rocaille', label: 'Rokajl 11/0', perGram: 110 },
  rocaille8: { size: [3.0, 2.0], kind: 'rocaille', label: 'Rokajl 8/0', perGram: 36 },
  round3: { size: [3, 3], kind: 'round', label: 'Kulička 3 mm', perGram: 28 },
  round4: { size: [4, 4], kind: 'round', label: 'Kulička 4 mm', perGram: 12 },
  round6: { size: [6, 6], kind: 'round', label: 'Kulička 6 mm', perGram: 3.5 },
  round8: { size: [8, 8], kind: 'round', label: 'Kulička 8 mm', perGram: 1.5 },
  halftila: { size: [5, 2.35, 1.9], kind: 'tile', label: 'Half Tila', perGram: 32 },
  tila: { size: [5, 5, 1.9], kind: 'tile', label: 'Tila', perGram: 16 },
  cube3: { size: [3, 3], kind: 'cube', label: 'Krychlička 3 mm', perGram: 16 },
  cube4: { size: [4, 4], kind: 'cube', label: 'Krychlička 4 mm', perGram: 7 },
  letter6: { size: [6, 6], kind: 'cube', label: 'Kostka s písmenem 6 mm', perGram: 5 },
  bugle3: { size: [1.7, 3], kind: 'bugle', label: 'Tyčinka 3 mm', perGram: 55 },
  bugle6: { size: [1.9, 6], kind: 'bugle', label: 'Tyčinka 6 mm', perGram: 24 },
  drop: { size: [2.8, 3.4], kind: 'drop', label: 'Kapka 3,4 mm', perGram: 20 },
  bicone4: { size: [4, 4], kind: 'bicone', label: 'Broušený krystal 4 mm', perGram: 14, finish: 'crystal' },
  cordseg: { size: [1, 1.25], kind: 'cordseg', label: 'Šňůrka 1 mm', perGram: 900, finish: 'cord', noCount: true },
  cordloop: { size: [1.1, 4], kind: 'cordloop', label: 'Šňůrka 1 mm', perGram: 900, finish: 'cord', noCount: true },
};

// How far a bead reaches from its centre, so nothing sinks into the table.
export function reach(shape) {
  const def = SHAPES[shape];
  if (def.kind === 'tile') return def.size[2] / 2;
  if (def.kind === 'drop') return def.size[1];
  return def.size[0] / 2;
}

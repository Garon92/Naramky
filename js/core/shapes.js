// Bead shapes with their real sizes in millimetres: diameter, then length along the hole.
export const SHAPES = {
  delica15: { size: [1.3, 1.15], kind: 'delica', label: 'Delica 15/0 (DBS)' },
  delica11: { size: [1.6, 1.3], kind: 'delica', label: 'Delica 11/0 (DB)' },
  delica10: { size: [2.2, 1.7], kind: 'delica', label: 'Delica 10/0 (DBM)' },
  rocaille15: { size: [1.5, 1.0], kind: 'rocaille', label: 'Rokajl 15/0' },
  rocaille11: { size: [2.2, 1.45], kind: 'rocaille', label: 'Rokajl 11/0' },
  rocaille8: { size: [3.0, 2.0], kind: 'rocaille', label: 'Rokajl 8/0' },
  round3: { size: [3, 3], kind: 'round', label: 'Kulička 3 mm' },
  round4: { size: [4, 4], kind: 'round', label: 'Kulička 4 mm' },
  halftila: { size: [5, 2.35, 1.9], kind: 'tile', label: 'Half Tila' },
};

// Shapes drawn by hand carry the whole drawing in their id, so a design or a link holds them
// without any shared storage. ~b<parity>.<rows> sits on the brick lattice of sewn bands and
// ~g.<rows> on the straight grid of woven ones. A row is the mask of its beads in base 36,
// followed after a dash by the mask of its centre beads.
const MAX_ROWS = 25;
const MAX_COLS = 30;

export const isDrawn = (id) => typeof id === 'string' && id.startsWith('~');

const isBead = (ch) => ch === '#' || ch === 'o';

// Art as in motifs.js (brick) or pixels.js (grid). Empty margins do not count, so the same
// shape always gets the same id.
export function encodeDrawn(art, grid = false) {
  const beads = [];
  art.forEach((line, row) => {
    for (let p = 0; p < line.length; p++) if (isBead(line[p])) beads.push({ row, p, center: line[p] === 'o' });
  });
  if (!beads.length) return null;
  const top = Math.min(...beads.map((b) => b.row));
  const bottom = Math.max(...beads.map((b) => b.row));
  const left = Math.min(...beads.map((b) => b.p));
  const parity = grid ? 0 : (beads[0].p - left + beads[0].row - top) % 2;
  const rows = Array.from({ length: bottom - top + 1 }, () => [0, 0]);
  for (const b of beads) {
    const p = b.p - left;
    const col = grid ? p : Math.floor(p / 2);
    rows[b.row - top][b.center ? 1 : 0] |= 2 ** col;
  }
  const text = rows.map(([main, center]) => (center ? `${main.toString(36)}-${center.toString(36)}` : main.toString(36)));
  return `~${grid ? 'g' : `b${parity}`}.${text.join('.')}`;
}

const decoded = new Map();

export function decodeDrawn(id, grid = false) {
  if (decoded.has(id)) return decoded.get(id);
  const [head, ...rows] = String(id).split('.');
  const parity = Number(head[2]);
  const valid = grid ? head === '~g' : head === '~b0' || head === '~b1';
  if (!valid || !rows.length || rows.length > MAX_ROWS) throw new Error('Neznámý tvar');
  const art = rows.map((text, row) => {
    const [main, center] = text.split('-').map((v) => parseInt(v, 36));
    if (!Number.isSafeInteger(main) || main < 0 || main >= 2 ** MAX_COLS) throw new Error('Poškozený tvar');
    const chars = [];
    for (let col = 0; col < MAX_COLS; col++) {
      const bit = 2 ** col;
      const ch = Math.floor((center || 0) / bit) % 2 ? 'o' : Math.floor(main / bit) % 2 ? '#' : null;
      if (ch) chars[grid ? col : 2 * col + ((row + parity) % 2)] = ch;
    }
    return Array.from(chars, (ch) => ch ?? (grid ? '.' : ' ')).join('');
  });
  if (!art.some((line) => /[#o]/.test(line))) throw new Error('Prázdný tvar');
  decoded.set(id, art);
  return art;
}

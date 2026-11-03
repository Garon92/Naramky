// A small bead font. Letters become drawn shapes, so they work like any other picture.
import { encodeDrawn } from './drawn.js';

// Seven rows, five columns, written as hex masks with the left column in the high bit.
const FONT = {
  A: '0e 11 11 1f 11 11 11', B: '1e 11 11 1e 11 11 1e', C: '0e 11 10 10 10 11 0e', D: '1e 11 11 11 11 11 1e',
  E: '1f 10 10 1e 10 10 1f', F: '1f 10 10 1e 10 10 10', G: '0e 11 10 17 11 11 0e', H: '11 11 11 1f 11 11 11',
  I: '0e 04 04 04 04 04 0e', J: '07 02 02 02 02 12 0c', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1f',
  M: '11 1b 15 15 11 11 11', N: '11 19 15 13 11 11 11', O: '0e 11 11 11 11 11 0e', P: '1e 11 11 1e 10 10 10',
  Q: '0e 11 11 11 15 12 0d', R: '1e 11 11 1e 14 12 11', S: '0f 10 10 0e 01 01 1e', T: '1f 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0e', V: '11 11 11 11 11 0a 04', W: '11 11 11 15 15 1b 11', X: '11 11 0a 04 0a 11 11',
  Y: '11 11 0a 04 04 04 04', Z: '1f 01 02 04 08 10 1f',
};
// A hook above the letter takes two more rows, which keeps the height odd like the others.
const HOOKED = { Č: 'C', Š: 'S', Ř: 'R', Ž: 'Z' };
const HOOK = '0a 04';

export const LETTERS = [...Object.keys(FONT), ...Object.keys(HOOKED)].sort((a, b) => a.localeCompare(b, 'cs'));

export function letterShape(letter, grid = false) {
  const code = HOOKED[letter] ? `${HOOK} ${FONT[HOOKED[letter]]}` : FONT[letter];
  const art = code.split(' ').map((hex, row) => {
    const mask = parseInt(hex, 16);
    const chars = [];
    for (let col = 0; col < 5; col++) {
      if (!((mask >> (4 - col)) & 1)) continue;
      if (grid) chars[col] = '#';
      // Rows of a sewn band shift by half a bead. Two beads, then one between them, keep a
      // stroke straight, where a single bead per row would zigzag.
      else if (row % 2) chars[2 * col + 1] = '#';
      else chars[2 * col] = chars[2 * col + 2] = '#';
    }
    return Array.from(chars, (ch) => ch ?? (grid ? '.' : ' ')).join('');
  });
  return encodeDrawn(art, grid);
}

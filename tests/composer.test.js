import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, patternById } from '../js/core/presets.js';
import { encodeShare, decodeShare } from '../js/core/link.js';
import { encodeDesign, decodeDesign, setFigures, applyMotifSettings, applyColorway, materials, sceneSpec } from '../js/core/design.js';
import { encodeDrawn, decodeDrawn } from '../js/core/drawn.js';
import { LETTERS, letterShape } from '../js/core/letters.js';
import { parseMotif, MOTIFS } from '../js/core/motifs.js';
import { pixelSize, PIXELS } from '../js/core/pixels.js';
import { generate, fittedWidth, placeFigures, figuresOf, NONE } from '../js/techniques/peyote.js';

const hearts = () => patternById('srdce').make();
const list = (d) => figuresOf(d.parts[0].params).map((id, from) => ({ id, from }));

test('a drawn shape survives inside its id, on both lattices', () => {
  for (const [id, m] of Object.entries(MOTIFS)) {
    const code = encodeDrawn(m.art);
    const again = parseMotif(code);
    const own = parseMotif(id);
    assert.equal(again.rows, own.rows, id);
    assert.equal(again.widthBeads, own.widthBeads, id);
    assert.deepEqual(again.beads.map((b) => `${b.row}:${b.x}:${b.center}`).sort(), own.beads.map((b) => `${b.row}:${b.x}:${b.center}`).sort(), id);
    assert.equal(encodeDrawn(decodeDrawn(code)), code, id);
  }
  const art = PIXELS.flower.art;
  const code = encodeDrawn(art, true);
  assert.deepEqual(decodeDrawn(code, true).map((l) => l.replace(/\.+$/, '')), art.map((l) => l.replace(/\.+$/, '')));
});

test('empty margins do not change a drawn shape', () => {
  const tight = encodeDrawn(['#.#', '###'], true);
  assert.equal(encodeDrawn(['.....', '.#.#.', '.###.', '.....'], true), tight);
  assert.equal(encodeDrawn(['  ', '   # #', '  # # #'], false), encodeDrawn([' # #', '# # #'], false));
  assert.equal(encodeDrawn(['...', '...'], true), null);
});

test('damaged drawn shapes are refused', () => {
  for (const bad of ['~', '~x.1', '~b0', '~b0.0.0', '~b0.zzzzzzzzzzzzzz']) assert.throws(() => decodeDrawn(bad), bad);
  assert.throws(() => generate({ kind: 'motifs', seq: ['~b0.0'], w: 9, n: 40 }));
  assert.throws(() => generate({ kind: 'motifs', seq: ['neexistuje'], w: 9, n: 40 }));
});

test('every letter works on both lattices and keeps an odd height', () => {
  for (const letter of LETTERS) {
    const brick = parseMotif(letterShape(letter, false));
    assert.equal(brick.rows % 2, 1, letter);
    const grid = pixelSize(letterShape(letter, true));
    assert.equal(grid.rows % 2, 1, letter);
  }
  assert.ok(LETTERS.includes('Š') && LETTERS.includes('Ž'));
});

test('pictures keep their colour and name wherever they move', () => {
  const d = hearts();
  const codes = d.slots.slice(1, 5).map((s) => s.code);
  d.slots[2].label = 'Honzík';
  const moved = list(d);
  moved.push(moved.shift());
  setFigures(d, d.parts[0], moved);
  assert.deepEqual(d.slots.slice(1, 5).map((s) => s.code), [codes[1], codes[2], codes[3], codes[0]]);
  assert.equal(d.slots[1].label, 'Honzík');
  assert.equal(d.slots[2].label, 'Srdíčko 2', 'names nobody chose follow the new position');
});

test('removing and adding pictures', () => {
  const d = hearts();
  const codes = d.slots.slice(1, 5).map((s) => s.code);
  const shorter = list(d);
  shorter.splice(1, 1);
  setFigures(d, d.parts[0], shorter);
  assert.equal(d.slots.length, 4);
  assert.deepEqual(d.slots.slice(1).map((s) => s.code), [codes[0], codes[2], codes[3]]);
  setFigures(d, d.parts[0], [...list(d), { id: 'star', from: null }]);
  assert.equal(d.slots.length, 5);
  assert.ok(!d.slots.slice(0, 4).some((s) => s.code === d.slots[4].code), 'a new picture gets a colour of its own');
});

test('groups follow the shapes, and colour combinations still fit', () => {
  const d = hearts();
  assert.equal(d.slots[1].group, 'Srdíčka');
  const mixed = list(d);
  mixed[2].id = 'star';
  setFigures(d, d.parts[0], mixed);
  assert.equal(d.slots[1].group, 'Motivy');
  assert.equal(d.slots[3].label, 'Hvězda 3');
  const way = patternById('srdce').colorways[7];
  applyColorway(d, way);
  const expected = patternById('srdce').make();
  applyColorway(expected, way);
  assert.deepEqual(d.slots.slice(0, 5).map((s) => s.code), expected.slots.slice(0, 5).map((s) => s.code));
});

test('a flower among hearts brings its centre, and loses it again', () => {
  const d = hearts();
  const withFlower = list(d);
  withFlower[0].id = 'flower';
  setFigures(d, d.parts[0], withFlower);
  assert.equal(d.slots.find((s) => s.group === 'Středy').code, 'DB0721');
  withFlower[0].id = 'heartN';
  setFigures(d, d.parts[0], withFlower);
  assert.equal(d.slots.some((s) => s.group === 'Středy'), false);
});

test('the band follows the tallest picture, also a drawn one', () => {
  const d = hearts();
  const tall = encodeDrawn(['#', ' #', '#', ' #', '#', ' #', '#', ' #', '#', ' #', '#', ' #', '#'], false);
  const row = list(d);
  row[1].id = tall;
  setFigures(d, d.parts[0], row);
  assert.equal(d.parts[0].params.w, 15);
  applyMotifSettings(d, d.parts[0], { w: 20 });
  assert.equal(d.parts[0].params.w, 21, 'a width chosen by hand is only evened up');
  setFigures(d, d.parts[0], list(d).slice(0, 2));
  assert.equal(d.parts[0].params.w, 21, 'and it stays');
});

const margins = (p) => {
  const { cells } = generate({ ...p, ends: 0 });
  const { w, n, loom } = p;
  let left = Infinity;
  let right = -Infinity;
  for (let r = 0; r < w; r++) {
    for (let c = 0; c < n; c++) {
      if (!cells[r * n + c]) continue;
      const x = c + (loom ? 0 : (r % 2) / 2);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return { left, right: (loom ? n - 1 : n - 0.5) - right };
};

for (const id of ['srdce', 'hvezdy', 'kocicky', 'rodina', 'zviratka']) {
  test(`${id}: every layout leaves both margins the same`, () => {
    for (const layout of ['center', 'spread', 'repeat']) {
      const p = { ...patternById(id).make().parts[0].params, layout };
      const { left, right } = margins(p);
      assert.ok(Math.abs(left - right) <= 1, `${layout}: ${left} and ${right}`);
    }
  });
}

test('spread uses the whole length with equal gaps', () => {
  const p = { ...hearts().parts[0].params, layout: 'spread' };
  const { spots, gap, margin, overflow } = placeFigures(p);
  assert.equal(overflow, 0);
  assert.ok(gap > p.gap);
  assert.ok(margin >= gap / 2 && margin < gap / 2 + 3);
  const steps = spots.slice(1).map((s, i) => s.center - spots[i].center);
  assert.equal(new Set(steps).size, 1);
});

test('repeat fills the length and keeps colours per picture', () => {
  const p = { ...hearts().parts[0].params, layout: 'repeat', gap: 2 };
  const { spots, times, gap } = placeFigures(p);
  assert.ok(times >= 2);
  assert.equal(spots.length, 4 * times);
  assert.ok(gap >= 2);
  assert.equal(generate(p).roles.length, 5, 'no new colours');
  const wide = (i) => [...generate(p).cells].filter((c) => c === i).length;
  assert.equal(wide(1), times * parseMotif('heartN').beads.length);
});

test('a row that does not fit closes up first, and only then says what is missing', () => {
  const base = hearts().parts[0].params;
  const tight = placeFigures({ ...base, gap: 30 });
  assert.equal(tight.overflow, 0);
  assert.ok(tight.gap < 30);
  const many = placeFigures({ ...base, seq: Array(16).fill('heartN'), gap: 2 });
  assert.equal(many.gap, 0);
  assert.equal(many.overflow, 16 * 7 - base.n);
  assert.equal(placeFigures({ ...base, seq: Array(14).fill('heartN') }).overflow, 0);
});

test('ends take their room from the row', () => {
  const p = { ...hearts().parts[0].params, seq: Array(14).fill('heartN'), ends: 3 };
  assert.equal(placeFigures(p).overflow, 14 * 7 + 6 - p.n);
});

// Where the beads of each row start and end along the band.
function edges(p) {
  const { cells } = generate(p);
  const { w, n, loom } = p;
  return Array.from({ length: w }, (_, r) => {
    const xs = [];
    for (let c = 0; c < n; c++) if (cells[r * n + c] !== NONE) xs.push(c + (loom ? 0 : (r % 2) / 2));
    return { left: xs[0], right: (loom ? n - 1 : n - 0.5) - xs[xs.length - 1] };
  });
}

test('a pointed end runs straight along the weave, and both ends match', () => {
  for (const w of [9, 10, 11, 12, 13, 15]) {
    const rows = edges({ kind: 'motifs', seq: [], w, n: 40, taper: true });
    const middle = Math.floor((w - 1) / 2);
    const half = (from, step, end) => {
      const list = [];
      for (let r = from; step < 0 ? r >= end : r <= end; r += step) list.push(rows[r]);
      return list;
    };
    for (const part of [half(middle, -1, 0), half(w - 1 - middle, 1, w - 1)]) {
      part.forEach((row, i) => {
        if (!i) return;
        assert.equal(row.left - part[i - 1].left, 0.5, `w ${w}: left edge`);
        assert.equal(row.right - part[i - 1].right, 0.5, `w ${w}: right edge`);
      });
    }
    for (const row of rows) assert.ok(Math.abs(row.left - row.right) <= 0.5, `w ${w}: ends differ, ${row.left} and ${row.right}`);
  }
});

test('a pointed end on a woven band loses one bead per row on both sides', () => {
  const rows = edges({ kind: 'pixels', items: [], w: 11, n: 40, taper: true, loom: true });
  assert.deepEqual(rows.map((r) => r.left), [5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(rows.map((r) => r.right), rows.map((r) => r.left));
});

test('coloured ends follow a pointed end, and pictures keep away from it', () => {
  const p = { kind: 'motifs', seq: ['heartN'], w: 11, n: 40, taper: true, ends: 2, gap: 2 };
  const { cells, roles } = generate(p);
  const left = roles.findIndex((r) => r.label === 'Levý konec');
  const right = roles.findIndex((r) => r.label === 'Pravý konec');
  for (let r = 0; r < p.w; r++) {
    const row = Array.from(cells.slice(r * p.n, (r + 1) * p.n));
    assert.equal(row.filter((v) => v === left).length, 2, `row ${r}`);
    assert.equal(row.filter((v) => v === right).length, 2, `row ${r}`);
    const first = row.findIndex((v) => v !== NONE);
    assert.equal(row[first], left, `row ${r} starts with its end`);
  }
  const full = { ...p, seq: Array(5).fill('heartN'), gap: 0 };
  assert.equal(placeFigures(full).overflow, 5 * 7 + 2 * (2 + 3) - full.n);
});

test('a frame adds rows and keeps a free row next to the picture', () => {
  const d = hearts();
  const part = d.parts[0];
  applyMotifSettings(d, part, { frame: 1 });
  assert.equal(part.params.w, 13);
  assert.equal(d.slots.find((s) => s.group === 'Lem').code, 'DB0031');
  const { cells, roles } = generate(part.params);
  const lem = roles.findIndex((r) => r.group === 'Lem');
  const { n, w } = part.params;
  for (const r of [0, w - 1]) for (let c = 0; c < n; c++) assert.equal(cells[r * n + c], lem);
  assert.equal(fittedWidth(part.params), 13);
  for (let c = 0; c < n; c++) assert.equal(cells[n + c], 0, 'the row next to the frame is free');
});

test('a design saved with fewer colours than its pictures need is refused, not drawn wrong', () => {
  const d = patternById('jahody').make();
  const saved = JSON.parse(Buffer.from(encodeDesign(d), 'base64url').toString());
  saved.s = saved.s.slice(0, 2);
  assert.throws(() => decodeDesign(Buffer.from(JSON.stringify(saved)).toString('base64url')));
});

test('an empty band works everywhere', () => {
  for (const id of ['prazdny-sity', 'prazdny-tkany']) {
    const d = patternById(id).make();
    assert.equal(d.slots.length, 1);
    assert.equal(sceneSpec(d).instances.length, d.parts[0].params.w * d.parts[0].params.n);
    assert.equal(materials(d).length, 1);
    assert.equal(encodeDesign(decodeShare(encodeShare(d))), encodeDesign(d));
    const key = id === 'prazdny-sity' ? 'heartN' : 'heart';
    setFigures(d, d.parts[0], [{ id: key, from: null }]);
    assert.equal(d.slots.length, 2);
    assert.equal(d.parts[0].params.w, id === 'prazdny-sity' ? 11 : 10);
    const back = decodeShare(encodeShare(d));
    assert.equal(encodeDesign(back), encodeDesign(d));
  }
});

test('links and saved designs carry drawn shapes, repeated ones only once', () => {
  const drawn = encodeDrawn(['  # #', ' # # #', '# # # #', ' # o #', '  # #'], false);
  const d = hearts();
  setFigures(d, d.parts[0], list(d).map((f) => ({ ...f, id: drawn })));
  applyMotifSettings(d, d.parts[0], { layout: 'repeat', frame: 1, gap: 4 });
  d.colorway = null;
  const code = encodeShare(d);
  assert.equal(encodeDesign(decodeShare(code)), encodeDesign(d));
  assert.equal(encodeDesign(decodeDesign(encodeDesign(d))), encodeDesign(d));
  assert.ok(code.length < 300, `${code.length}: ${code}`);
});

test('every pattern can have its pictures rearranged and shared', () => {
  for (const p of PATTERNS) {
    const d = p.make();
    const part = d.parts[0];
    if (part.tech !== 'peyote' || !['motifs', 'pixels'].includes(part.params.kind) || !figuresOf(part.params).length) continue;
    const row = list(d).reverse();
    row.push({ id: row[0].id, from: null });
    setFigures(d, part, row);
    assert.equal(encodeDesign(decodeShare(encodeShare(d))), encodeDesign(d), p.id);
  }
});

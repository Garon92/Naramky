import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, COLLECTIONS, patternById } from '../js/core/presets.js';
import {
  encodeDesign, decodeDesign, materials, sceneSpec, clone, colsForWrist, groupsOf, groupOfSlot, setGroupColor,
  applyColorway, setBeadSlot, extraSlotFor, pruneExtras, resetBead, removeExtraColor, EXTRA_GROUP, applyMotifSettings, applyWrist, TECHNIQUES,
} from '../js/core/design.js';
import { MOTIFS, parseMotif, placeMotif } from '../js/core/motifs.js';
import { pixelSize } from '../js/core/pixels.js';
import { bead, PALETTE, finishFromName, hasBead, codeOf } from '../js/core/catalog.js';
import {
  grid, generate, threadPasses, floodFill, mirrorCell, NONE, runLength, ensureCells, GENERATORS, bandSize,
} from '../js/techniques/peyote.js';

const hearts = () => patternById('srdce').make();

test('a pattern is a shape: colour combinations live inside one pattern', () => {
  const inHearts = PATTERNS.filter((p) => p.group === 'Čtyři srdíčka');
  assert.equal(inHearts.length, 4, 'plain, with ends, with spacers, with triangles');
  const combos = inHearts.reduce((sum, p) => sum + p.colorways.length, 0);
  assert.equal(combos, 48 + 30 + 8, 'every combination from the three images is kept');
  assert.equal(new Set(PATTERNS.map((p) => p.id)).size, PATTERNS.length);
});

test('every pattern sits in exactly one tab, and no tab lists an empty group', () => {
  for (const p of PATTERNS.filter((x) => !x.hidden)) assert.equal(COLLECTIONS.filter((c) => c.groups.includes(p.group)).length, 1, p.id);
  for (const group of COLLECTIONS.flatMap((c) => c.groups)) assert.ok(PATTERNS.some((p) => p.group === group), group);
});

test('colour combinations of a pattern never change its shape', () => {
  for (const p of PATTERNS) {
    const base = p.make();
    const shape = sceneSpec(base).instances.map((b) => `${b.s}:${b.t}:${b.shape}:${b.slot}`).join();
    for (const way of p.colorways) {
      const d = p.make();
      applyColorway(d, way);
      assert.equal(sceneSpec(d).instances.map((b) => `${b.s}:${b.t}:${b.shape}:${b.slot}`).join(), shape, `${p.id}: ${way.name}`);
      for (const s of d.slots) assert.ok(hasBead(s.code), `${p.id}: ${way.name}: ${s.code}`);
    }
  }
});

test('every colour combination fills every group it knows', () => {
  for (const p of PATTERNS) {
    const names = groupsOf(p.make()).map((g) => g.name);
    for (const way of p.colorways) {
      for (const key of Object.keys(way.colors)) assert.ok(names.includes(key), `${p.id}: ${way.name}: unknown group ${key}`);
      for (const value of Object.values(way.colors).flat()) assert.ok(hasBead(codeOf(value)), `${p.id}: ${value}`);
    }
  }
});

test('every pattern builds with real beads and sane materials', () => {
  for (const p of PATTERNS) {
    const d = p.make();
    const spec = sceneSpec(d);
    assert.ok(spec.instances.length > 20, p.id);
    for (const b of spec.instances) {
      assert.ok(Number.isFinite(b.s) && Number.isFinite(b.t), p.id);
      assert.ok(b.slot < d.slots.length, `${p.id}: slot ${b.slot} of ${d.slots.length}`);
    }
    assert.equal(materials(d).reduce((sum, l) => sum + l.count, 0), spec.instances.length, p.id);
  }
});

test('the band matches the reference: about 1.3 cm wide and 102 long', () => {
  const part = hearts().parts[0];
  const { w, n, cells } = grid(part);
  assert.equal(w, 11);
  assert.equal(n, 102);
  assert.equal(colsForWrist(16, 1.3), 102);
  const size = bandSize(part);
  assert.ok(size.width >= 12.5 && size.width <= 15, `1.3 to 1.5 cm wide, got ${size.width}`);
  assert.ok(size.length >= 132 && size.length <= 134, `about 13.3 cm long, got ${size.length}`);
  assert.equal(cells.filter((c) => c === NONE).length, 0);
});

test('a heart reads as a heart: two lobes, a notch, and one bead at the tip', () => {
  for (const id of ['heartS', 'heartN', 'heartM', 'heartL']) {
    const m = parseMotif(id);
    const row = (i) => m.beads.filter((b) => b.row === i).map((b) => b.x).sort((a, b) => a - b);
    assert.ok(!row(0).includes(0) && !row(0).includes(1), `${id}: gap between the lobes on top`);
    assert.deepEqual(row(m.rows - 1), [0], `${id}: one bead at the tip`);
    // Below the widest row the sides only ever narrow.
    let widest = 0;
    for (let i = 0; i < m.rows; i++) if (row(i).length >= row(widest).length) widest = i;
    for (let i = widest + 1; i < m.rows; i++) assert.ok(row(i).length < row(i - 1).length, `${id}: row ${i}`);
  }
  const m = parseMotif('heartN');
  assert.equal(m.widthBeads, 7);
  assert.equal(m.rows, 9);
  const ratio = (m.widthBeads * 1.3) / (m.rows * 1.15);
  assert.ok(ratio > 0.8 && ratio < 1.15, `about as wide as tall, got ${ratio}`);
});

test('four hearts are all there and fit inside the band', () => {
  const { cells } = grid(hearts().parts[0]);
  for (let i = 1; i <= 4; i++) {
    assert.equal(cells.filter((c) => c === i).length, parseMotif('heartN').beads.length, `heart ${i}`);
  }
});

test('motifs have the same free rows above and below, in every pattern', () => {
  for (const p of PATTERNS) {
    const part = p.make().parts[0];
    if (part.tech !== 'peyote' || part.params.kind !== 'motifs') continue;
    const { w, n, cells } = grid(part);
    part.params.seq.forEach((_, i) => {
      const rows = [];
      for (let r = 0; r < w; r++) {
        for (let c = 0; c < n; c++) if (cells[r * n + c] === i + 1) rows.push(r);
      }
      assert.equal(Math.min(...rows), w - 1 - Math.max(...rows), `${p.id}, motif ${i + 1}`);
    });
  }
});

test('a picture has exactly one free row above and below it', () => {
  for (const p of PATTERNS) {
    const part = p.make().parts[0];
    if (p.hidden || part.tech !== 'peyote' || !['motifs', 'pixels'].includes(part.params.kind)) continue;
    // Ends and triangles fill the free rows on purpose, so only the pictures are measured.
    const { w, n } = part.params;
    const { cells } = generate({ ...part.params, ends: 0, bg2: undefined });
    const rows = [];
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) if (cells[r * n + c]) rows.push(r);
    }
    assert.equal(Math.min(...rows), 1, `${p.id} above`);
    assert.equal(w - 1 - Math.max(...rows), 1, `${p.id} below`);
    for (const id of part.params.items ?? []) assert.equal((w - pixelSize(id).rows) % 2, 0, `${p.id}: ${id}`);
  }
});

test('the band follows the picture, and a width chosen by hand stays', () => {
  const d = hearts();
  const part = d.parts[0];
  for (const [motif, w] of [['heartS', 9], ['heartM', 12], ['heartL', 15], ['heartN', 11]]) {
    applyMotifSettings(d, part, { motif });
    assert.equal(part.params.w, w, motif);
  }
  applyMotifSettings(d, part, { w: 15 });
  assert.equal(part.params.w, 15);
  applyMotifSettings(d, part, { count: 3 });
  assert.equal(part.params.w, 15, 'more or fewer hearts do not touch a chosen width');
  applyMotifSettings(d, part, { w: 14 });
  assert.equal(part.params.w, 15, 'evened up, so the free rows match');
});

test('a flower has a centre in a colour of its own', () => {
  const d = patternById('kvetiny').make();
  const centre = groupsOf(d).find((g) => g.name === 'Středy');
  assert.equal(centre.slots.length, 1, 'all flowers share one centre colour');
  const { cells } = grid(d.parts[0]);
  assert.equal(cells.filter((c) => c === centre.slots[0]).length, 4 * parseMotif('flower').beads.filter((b) => b.center).length);
  const h = hearts();
  applyMotifSettings(h, h.parts[0], { motif: 'flower' });
  assert.equal(h.slots.find((x) => x.group === 'Středy').code, 'DB0721');
  applyMotifSettings(h, h.parts[0], { motif: 'heartN' });
  assert.equal(h.slots.some((x) => x.group === 'Středy'), false);
});

test('changing the motif keeps the free rows equal', () => {
  for (const motif of ['heartS', 'heartN', 'heartM', 'heartL', 'star', 'flower', 'clover', 'diamond']) {
    const d = hearts();
    applyMotifSettings(d, d.parts[0], { motif });
    const { w, n, cells } = grid(d.parts[0]);
    const rows = [];
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < n; c++) if (cells[r * n + c] === 1) rows.push(r);
    }
    assert.equal(Math.min(...rows), w - 1 - Math.max(...rows), motif);
  }
});

test('hearts are mirror symmetric', () => {
  for (const id of ['heartS', 'heartN', 'heartM', 'heartL']) {
    const set = new Set(parseMotif(id).beads.map((b) => `${b.row}:${b.x}`));
    for (const b of parseMotif(id).beads) assert.ok(set.has(`${b.row}:${-b.x}`), `${id}: ${b.row}:${b.x}`);
  }
});

test('all motifs respect the half-bead offset', () => {
  for (const id of Object.keys(MOTIFS)) {
    const m = parseMotif(id);
    const parity = new Set(m.beads.map((b) => (((b.row + b.x) % 2) + 2) % 2));
    assert.equal(parity.size, 1, id);
  }
});

test('placed motifs land on real cells at both row parities', () => {
  for (const top of [1, 2]) {
    for (const X of [40, 41]) {
      const cells = placeMotif('heartM', X, top, 15, 102);
      assert.equal(cells.length, parseMotif('heartM').beads.length);
      for (const { r, c } of cells) assert.ok(Number.isInteger(c) && r >= 0 && r < 15, `${r},${c}`);
    }
  }
});

test('every generator fills the lattice with valid slots', () => {
  for (const kind of GENERATORS) {
    const params = { kind, w: 15, n: 60, seq: ['heartM'], colors: 3, weights: [0.5, 0.5], items: ['cat', 'heart'] };
    const { cells, roles } = generate(params);
    assert.equal(cells.length, 900, kind);
    for (const c of cells) assert.ok(c === NONE || c < roles.length, `${kind}: ${c} of ${roles.length}`);
  }
});

test('hearts, spacers and ends each group several separately colourable objects', () => {
  const d = patternById('srdce-mezi').make();
  const byName = Object.fromEntries(groupsOf(d).map((g) => [g.name, g.slots.length]));
  assert.deepEqual(byName, { Podklad: 1, Srdíčka: 4, Mezičlánky: 3, Konce: 2 });
  const { cells } = grid(d.parts[0]);
  for (let i = 0; i < d.slots.length; i++) assert.ok(cells.includes(i), `slot ${d.slots[i].label} is used`);
});

test('colour can go to all objects of a kind or to one', () => {
  const d = patternById('srdce-mezi').make();
  const heartSlot = d.slots.findIndex((s) => s.group === 'Srdíčka');
  setGroupColor(d, heartSlot, 'DB0721');
  assert.deepEqual(d.slots.filter((s) => s.group === 'Srdíčka').map((s) => s.code), Array(4).fill('DB0721'));
  assert.notEqual(d.slots[0].code, 'DB0721', 'other kinds stay');
  d.slots[heartSlot + 2].code = 'DB0726';
  assert.deepEqual(d.slots.filter((s) => s.group === 'Srdíčka').map((s) => s.code), ['DB0721', 'DB0721', 'DB0726', 'DB0721']);
  assert.equal(groupOfSlot(d, heartSlot + 2).name, 'Srdíčka');
});

test('a single bead can differ from the rest, in every technique, and go back', () => {
  const seen = new Set();
  for (const p of PATTERNS) {
    const d = p.make();
    seen.add(d.parts[0].tech);
    const before = sceneSpec(d).instances.map((b) => b.slot).join();
    const pick = sceneSpec(d).instances[5];
    const original = pick.slot;
    const slotCount = d.slots.length;
    setBeadSlot(d, pick, extraSlotFor(d, 'DB0727'));
    assert.equal(d.slots.length, slotCount + 1, p.id);
    const painted = sceneSpec(d).instances.filter((b) => b.slot === slotCount);
    assert.equal(painted.length, 1, p.id);
    assert.equal(sceneSpec(decodeDesign(encodeDesign(d))).instances.filter((b) => b.slot === slotCount).length, 1, `${p.id} in the link`);
    // Same colour reuses the slot, and going back removes the unused colour.
    assert.equal(extraSlotFor(d, 'DB0727'), slotCount);
    resetBead(d, { ...pick, slot: slotCount });
    pruneExtras(d);
    assert.equal(d.slots.length, slotCount, `${p.id}: colour disappears when unused`);
    assert.equal(sceneSpec(d).instances[5].slot, original, p.id);
    assert.equal(sceneSpec(d).instances.map((b) => b.slot).join(), before, p.id);
  }
  for (const tech of Object.keys(TECHNIQUES)) assert.ok(seen.has(tech), `technique ${tech} has a pattern`);
});

test('removing a colour of single beads returns them, and other slots keep their numbers right', () => {
  const d = patternById('srdce').make();
  const specs = sceneSpec(d).instances;
  const a = extraSlotFor(d, 'DB0727');
  setBeadSlot(d, specs[3], a);
  const b = extraSlotFor(d, 'DB0721');
  setBeadSlot(d, specs[4], b);
  removeExtraColor(d, a);
  assert.deepEqual(d.slots.filter((s) => s.group === EXTRA_GROUP).map((s) => s.code), ['DB0721']);
  const after = sceneSpec(d).instances;
  assert.equal(d.slots[after[4].slot].code, 'DB0721');
  assert.equal(after[3].slot, specs[3].slot);
});

test('there are many different kinds of bead and of joining them', () => {
  const shapes = new Set();
  const techs = new Set();
  for (const p of PATTERNS) {
    const d = p.make();
    for (const part of d.parts) techs.add(part.params.loom ? 'loom' : part.tech);
    for (const b of sceneSpec(d).instances) shapes.add(b.shape);
  }
  assert.ok(techs.size >= 14, `${techs.size} ways of joining`);
  assert.ok(shapes.size >= 14, `${shapes.size} kinds of bead: ${[...shapes].join()}`);
});

test('nothing sinks into the table', () => {
  for (const p of PATTERNS) {
    const spec = sceneSpec(p.make());
    assert.ok(spec.lift >= 0.65 && Number.isFinite(spec.lift), `${p.id}: ${spec.lift}`);
  }
});

test('pictures for the loom all fit their band and have a named colour for every part', () => {
  for (const p of PATTERNS.filter((x) => x.id && x.make().parts[0].params.loom && x.make().parts[0].params.kind === 'pixels')) {
    const d = p.make();
    const { cells } = grid(d.parts[0]);
    const used = new Set(cells);
    d.slots.forEach((slot, i) => assert.ok(used.has(i), `${p.id}: ${slot.label} is never used`));
    for (const way of p.colorways) {
      for (const g of groupsOf(d)) assert.ok(way.colors[g.name] !== undefined, `${p.id}: ${way.name} has no colour for ${g.name}`);
    }
  }
});

test('every colour combination colours all parts of its pattern', () => {
  for (const p of PATTERNS) {
    const names = groupsOf(p.make()).map((g) => g.name);
    for (const way of p.colorways) {
      for (const name of names) assert.ok(way.colors[name] !== undefined, `${p.id}: ${way.name} misses ${name}`);
    }
  }
});

test('changing hearts count keeps the colours and names of the others', () => {
  const d = patternById('srdce-mezi').make();
  d.slots[1].label = 'Honzík';
  d.slots[2].code = 'DB0721';
  applyMotifSettings(d, d.parts[0], { count: 6 });
  const group = groupsOf(d).find((g) => g.name === 'Srdíčka');
  assert.equal(group.slots.length, 6);
  assert.equal(d.slots[group.slots[0]].label, 'Honzík');
  assert.equal(d.slots[group.slots[1]].code, 'DB0721');
  assert.equal(groupsOf(d).find((g) => g.name === 'Mezičlánky').slots.length, 5);
  applyMotifSettings(d, d.parts[0], { count: 2 });
  assert.equal(groupsOf(d).find((g) => g.name === 'Mezičlánky').slots.length, 1);
  for (const c of grid(d.parts[0]).cells) assert.ok(c === NONE || c < d.slots.length);
});

test('wrist changes keep hand painting, centred', () => {
  const d = hearts();
  const part = d.parts[0];
  const cells = ensureCells(part);
  const oldN = part.params.n;
  cells[2 * oldN + 50] = 3;
  applyWrist(d, 18);
  assert.equal(part.params.n, colsForWrist(18, 1.3));
  const shift = Math.floor((part.params.n - oldN) / 2);
  assert.equal(part.cells[2 * part.params.n + 50 + shift], 3);
  assert.equal(part.cells.length, part.params.w * part.params.n);
});

test('design survives the share link, also with hand painting', () => {
  const d = patternById('srdce-mezi').make();
  d.note = 'Pro Janu, zápěstí 16 cm. Příliš žluťoučký kůň!';
  d.slots[1].label = 'Honzík';
  const pristine = encodeDesign(d);
  assert.ok(pristine.length < 1100, `short link: ${pristine.length}`);
  const back = decodeDesign(pristine);
  assert.equal(back.note, d.note);
  assert.deepEqual(back.slots, d.slots);
  assert.deepEqual(groupsOf(back), groupsOf(d));
  assert.deepEqual([...grid(back.parts[0]).cells], [...grid(d.parts[0]).cells]);

  const painted = clone(d);
  const cells = ensureCells(painted.parts[0]);
  cells[33] = 2;
  cells[34] = NONE;
  const link = encodeDesign(painted);
  assert.ok(link.length < 3000, `painted link stays short: ${link.length}`);
  const again = decodeDesign(link);
  assert.deepEqual([...again.parts[0].cells], [...cells]);
});

test('share link rejects junk', () => {
  assert.throws(() => decodeDesign('bm90IGpzb24'));
  assert.throws(() => decodeDesign(btoa(JSON.stringify({ v: 9 }))));
  assert.throws(() => decodeDesign(btoa(JSON.stringify({ v: 2, n: 'x', s: [['a', 'DB9999']], p: [] }))));
});

test('every pattern round trips through the share link', () => {
  for (const p of PATTERNS) {
    const d = p.make();
    assert.equal(sceneSpec(decodeDesign(encodeDesign(d))).instances.length, sceneSpec(d).instances.length, p.id);
  }
});

test('thread passes use every bead exactly once', () => {
  const part = { tech: 'peyote', params: { kind: 'motifs', w: 12, n: 30, seq: ['heartS'], gap: 2 }, cells: null };
  const { cells } = grid(part);
  const passes = threadPasses(part);
  assert.equal(passes.reduce((sum, p) => sum + p.slots.length, 0), cells.filter((c) => c !== NONE).length);
  assert.equal(passes[0].slots.length, 12);
  assert.equal(passes.length, 1 + 2 * 29);
});

test('run length collapses neighbours', () => {
  assert.deepEqual(runLength([1, 1, 2, 1]), [{ slot: 1, count: 2 }, { slot: 2, count: 1 }, { slot: 1, count: 1 }]);
});

test('flood fill stays inside its colour', () => {
  const w = 5;
  const n = 6;
  const cells = new Uint8Array(w * n);
  for (let r = 0; r < w; r++) cells[r * n + 3] = 1;
  assert.ok(floodFill(cells, w, n, 0, 0, 2) > 0);
  assert.equal(cells[0 * n + 5], 0, 'the far side stays');
  assert.equal(cells[2 * n + 3], 1, 'the wall stays');
});

test('mirror maps inside the grid', () => {
  for (const [w, n] of [[12, 102], [15, 102]]) {
    const out = mirrorCell(0, 0, w, n, true, true);
    assert.equal(out.length, 4);
    for (const [r, c] of out) assert.ok(r >= 0 && r < w && c >= 0 && c < n);
  }
});

test('catalogue knows the finishes and rejects unknown codes', () => {
  assert.equal(PALETTE.length >= 40, true);
  assert.equal(new Set(PALETTE.map((p) => p.code)).size, PALETTE.length);
  // A mix is several colours in one bag, so it cannot stand for one colour.
  assert.deepEqual(PALETTE.filter((p) => /\bmix\b/i.test(bead(p.code).name)).map((p) => p.code), []);
  assert.equal(bead('DB0031').finish, 'metal');
  assert.equal(bead('DB0010').finish, 'opaque');
  assert.equal(finishFromName('Matte Opaque Blue', 'o'), 'matte');
  assert.throws(() => bead('DB9999'));
  assert.equal(codeOf('gold'), 'DB0031');
});

test('colour codes from the original image that turned out to be wrong are not used as labelled', () => {
  assert.equal(bead('DB0726').hex.toLowerCase(), '201576', 'DB-0726 is cobalt, not pink');
  assert.equal(bead('DB0214').family, 'red', 'DB-0214 is red, not cobalt');
  assert.equal(hasBead('DB0719'), false, 'DB-0719 does not exist');
  assert.equal(bead('DB0757').family, 'red', 'DB-0757 is plain red, not raspberry');
});

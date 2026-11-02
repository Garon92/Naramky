import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, patternById } from '../js/core/presets.js';
import { encodeShare, decodeShare } from '../js/core/link.js';
import { encodeDesign, applyColorway, applyMotifSettings, applyWrist, setBeadSlot, extraSlotFor, sceneSpec, groupsOf } from '../js/core/design.js';
import { ensureCells, NONE, grid } from '../js/techniques/peyote.js';

const roundTrip = (d) => decodeShare(encodeShare(d));
const same = (a, b, label) => assert.equal(encodeDesign(a), encodeDesign(b), label);

test('an untouched pattern and colour combination make a very short link', () => {
  for (const p of PATTERNS) {
    const d = p.make();
    const code = encodeShare(d);
    assert.ok(code.length <= 40, `${p.id}: ${code.length} ${code}`);
    same(roundTrip(d), d, p.id);
    for (const way of p.colorways) {
      const w = p.make();
      applyColorway(w, way);
      assert.ok(encodeShare(w).length <= 40, `${p.id} ${way.name}`);
      same(roundTrip(w), w, `${p.id}: ${way.name}`);
    }
  }
});

test('own colours add only a little', () => {
  const d = patternById('srdce-mezi').make();
  const group = groupsOf(d).find((g) => g.name === 'Srdíčka');
  d.slots[group.slots[0]].code = 'DB0721';
  d.slots[group.slots[2]].code = 'DB2121';
  d.colorway = null;
  const code = encodeShare(d);
  assert.ok(code.length < 90, `${code.length}: ${code}`);
  same(decodeShare(code), d);
});

test('a few recoloured beads add only a little', () => {
  const d = patternById('srdce').make();
  const beads = sceneSpec(d).instances;
  for (const i of [10, 11, 12, 200, 500]) setBeadSlot(d, beads[i], extraSlotFor(d, 'DB0727'));
  d.colorway = null;
  const code = encodeShare(d);
  assert.ok(code.length < 130, `${code.length}: ${code}`);
  same(decodeShare(code), d);
});

test('hand painting stays far shorter than the whole band', () => {
  const d = patternById('srdce-konce').make();
  const part = d.parts[0];
  const cells = ensureCells(part);
  for (let i = 0; i < 40; i++) cells[(i * 37) % cells.length] = (i % 3) + 1;
  cells[5] = NONE;
  d.colorway = null;
  const code = encodeShare(d);
  assert.ok(code.length < 500, `${code.length}`);
  same(decodeShare(code), d);
});

test('names, notes and settings survive and still make a short link', () => {
  const d = patternById('srdce-mezi').make();
  d.name = 'Pro Janu';
  d.note = 'Příliš žluťoučký kůň';
  d.slots[1].label = 'Honzík';
  d.metal = 'rose';
  d.surface = 'linen';
  applyWrist(d, 18);
  const code = encodeShare(d);
  assert.ok(code.length < 240, `${code.length}: ${code}`);
  same(decodeShare(code), d);
});

test('changing the number of hearts survives', () => {
  const d = patternById('srdce-mezi').make();
  applyMotifSettings(d, d.parts[0], { count: 6 });
  const code = encodeShare(d);
  assert.ok(code.length < 240, `${code.length}: ${code}`);
  same(decodeShare(code), d);
  assert.deepEqual([...grid(decodeShare(code).parts[0]).cells], [...grid(d.parts[0]).cells]);
});

test('settings of other techniques survive', () => {
  const d = patternById('pismenka').make();
  d.parts[0].params.text = 'HONZA ♥';
  d.colorway = null;
  same(roundTrip(d), d);
});

test('every pattern survives a full round of changes', () => {
  for (const p of PATTERNS) {
    const d = p.make();
    d.name = 'Pro Janu';
    d.note = 'Příliš žluťoučký kůň';
    d.metal = 'rose';
    d.surface = 'linen';
    applyWrist(d, 18);
    groupsOf(d).forEach((g, i) => {
      d.slots[g.slots[0]].code = i % 2 ? 'DB0721' : 'DB2121';
    });
    d.colorway = null;
    const beads = sceneSpec(d).instances.filter((b) => !b.noCount);
    for (const i of [0, 3, 7]) if (beads[i]) setBeadSlot(d, beads[i], extraSlotFor(d, 'DB0727'));
    same(roundTrip(d), d, p.id);
  }
});

test('a design whose pattern is gone has no link', () => {
  const d = patternById('srdce').make();
  d.preset = 'zmizel';
  assert.equal(encodeShare(d), null);
});

test('unknown or damaged links are refused', () => {
  assert.throws(() => decodeShare('neexistuje.0'));
  assert.throws(() => decodeShare('srdce.zz'));
  assert.throws(() => decodeShare('eyJub25zZW5zZQ'));
});

test('a link cannot ask for an absurdly big band', () => {
  const evil = encodeShare(patternById('srdce').make()).split('.')[0];
  const meta = Buffer.from(JSON.stringify({ p: [{ n: 100000 }] })).toString('base64url');
  assert.throws(() => decodeShare(`${evil}...${meta}`));
});

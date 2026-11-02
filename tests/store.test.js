import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
globalThis.location = { origin: 'https://example.test', pathname: '/Naramky/' };

const { store, saveCurrent, savedList, deleteSaved, duplicateSaved, shareLink, restoreSession } = await import('../js/ui/store.js');
const { patternById } = await import('../js/core/presets.js');
const { decodeDesign, encodeDesign, applyColorway } = await import('../js/core/design.js');
const { decodeShare } = await import('../js/core/link.js');

const hearts = () => patternById('srdce').make();

beforeEach(() => {
  memory.clear();
  store.load(hearts());
});

test('saving two designs with the same name keeps both', () => {
  store.design.slots[1].code = 'DB0721';
  assert.equal(saveCurrent().ok, true);
  store.load(hearts());
  store.design.slots[1].code = 'DB0726';
  const second = saveCurrent();
  assert.equal(second.ok, true);
  const list = savedList();
  assert.equal(list.length, 2, 'the first one must not be overwritten');
  assert.notEqual(list[0].name, list[1].name);
  assert.equal(second.name, '4 srdíčka 2');
  assert.deepEqual(new Set(list.map((x) => decodeDesign(x.data).slots[1].code)), new Set(['DB0721', 'DB0726']));
});

test('saving again updates the same entry, also after a rename', () => {
  saveCurrent();
  const id = store.savedId;
  store.design.name = 'Pro Janu';
  store.design.slots[1].code = 'DB0721';
  saveCurrent();
  const list = savedList();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, id);
  assert.equal(list[0].name, 'Pro Janu');
  assert.equal(decodeDesign(list[0].data).slots[1].code, 'DB0721');
  assert.equal(store.isDirty(), false);
});

test('opening something else keeps unsaved work', () => {
  store.design.slots[1].code = 'DB0721';
  store.design.note = 'Rozdělané';
  const kept = store.open(patternById('zigzag').make());
  assert.equal(kept, '4 srdíčka');
  const list = savedList();
  assert.equal(list.length, 1);
  assert.equal(decodeDesign(list[0].data).note, 'Rozdělané');
  assert.equal(store.design.name, 'Šitý zig-zag');
  assert.equal(store.savedId, null);
});

test('nothing piles up when only browsing patterns and colour combinations', () => {
  const pattern = patternById('srdce');
  applyColorway(store.design, pattern.colorways[5]);
  assert.equal(store.open(patternById('zigzag').make()), null);
  assert.equal(savedList().length, 0);
  // Untouched, then a real change on top of a combination: this one is kept.
  store.load(hearts());
  applyColorway(store.design, pattern.colorways[5]);
  store.design.slots[1].code = 'DB0727';
  assert.equal(store.open(patternById('zigzag').make()), '4 srdíčka');
});

test('opening the design already being edited keeps the edits on screen', () => {
  saveCurrent();
  const id = store.savedId;
  store.design.slots[1].code = 'DB0721';
  const stale = decodeDesign(savedList()[0].data);
  assert.equal(store.open(stale, { savedId: id }), null);
  assert.equal(store.design.slots[1].code, 'DB0721');
});

test('edits to a saved design go back to its own entry when leaving it', () => {
  saveCurrent();
  const id = store.savedId;
  store.design.slots[1].code = 'DB0721';
  store.open(patternById('zigzag').make());
  const list = savedList();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, id);
  assert.equal(decodeDesign(list[0].data).slots[1].code, 'DB0721');
});

test('copying and deleting saved designs', () => {
  saveCurrent();
  const id = store.savedId;
  assert.equal(duplicateSaved(id), true);
  let list = savedList();
  assert.equal(list.length, 2);
  assert.equal(list[0].name, '4 srdíčka kopie');
  assert.equal(decodeDesign(list[0].data).name, '4 srdíčka kopie');
  deleteSaved(id);
  list = savedList();
  assert.equal(list.length, 1);
  assert.equal(store.savedId, null, 'the design on screen stays, and saves as a new entry');
  saveCurrent();
  assert.equal(savedList().length, 2);
});

test('a reload continues with unsaved changes and still knows they are unsaved', () => {
  saveCurrent();
  const id = store.savedId;
  store.design.slots[1].code = 'DB0721';
  store.notify('color');
  // pagehide writes the session; the same write happens through saving and autosave.
  memory.set('naramky:current', encodeDesign(store.design));
  memory.set('naramky:current-meta', JSON.stringify({ savedId: store.savedId, base: store.baseline }));
  store.load(patternById('zigzag').make());
  restoreSession();
  assert.equal(store.design.slots[1].code, 'DB0721');
  assert.equal(store.savedId, id);
  assert.equal(store.isDirty(), true);
});

test('a broken autosave falls back to the default pattern', () => {
  memory.set('naramky:current', 'garbage');
  restoreSession();
  assert.equal(store.design.preset, 'srdce-mezi');
  assert.equal(store.isDirty(), false);
});

test('an encoded design does not change by being decoded', () => {
  const data = encodeDesign(store.design);
  assert.equal(encodeDesign(decodeDesign(data)), data);
});

test('a share link holds the design but no private save data', () => {
  saveCurrent();
  const link = shareLink(store.design);
  assert.ok(link.startsWith('https://example.test/Naramky/#/n/'));
  const back = decodeShare(link.split('#/n/')[1]);
  assert.equal(back.name, store.design.name);
  assert.equal(back.savedId, undefined);
});

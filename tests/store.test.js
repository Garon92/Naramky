import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
globalThis.location = { origin: 'https://example.test', pathname: '/Naramky/' };

const {
  store, saveCurrent, savedTarget, savedList, deleteSaved, deleteAllSaved, duplicateSaved, shareLink, restoreSession,
  draftList, openDraft, saveDraft, deleteDraft, DRAFT_LIMIT,
} = await import('../js/ui/store.js');
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

test('changes to a saved design can go next to it as a new one', () => {
  saveCurrent();
  const first = store.savedId;
  const before = decodeDesign(savedList()[0].data).slots[1].code;
  assert.equal(savedTarget(), null, 'nothing to ask while nothing changed');
  store.design.slots[1].code = before === 'DB0721' ? 'DB0726' : 'DB0721';
  assert.equal(savedTarget().id, first);
  const second = saveCurrent({ asNew: true });
  const list = savedList();
  assert.equal(list.length, 2);
  assert.equal(second.name, '4 srdíčka 2');
  assert.notEqual(store.savedId, first);
  assert.equal(decodeDesign(list.find((x) => x.id === first).data).slots[1].code, before, 'the first one stays as it was');
  assert.equal(store.isDirty(), false);
});

test('opening something else keeps unsaved work as a draft, not as a saved design', () => {
  store.design.slots[1].code = 'DB0721';
  store.design.note = 'Rozdělané';
  assert.equal(store.open(patternById('zigzag').make()), true);
  assert.equal(savedList().length, 0, 'only the Save button fills the saved designs');
  const [draft] = draftList();
  assert.equal(decodeDesign(draft.data).note, 'Rozdělané');
  assert.equal(store.design.name, 'Šitý zig-zag');
  assert.equal(store.savedId, null);
});

test('nothing piles up when only browsing patterns and colour combinations', () => {
  const pattern = patternById('srdce');
  applyColorway(store.design, pattern.colorways[5]);
  assert.equal(store.open(patternById('zigzag').make()), false);
  assert.equal(draftList().length, 0);
  // Untouched, then a real change on top of a combination: this one is kept.
  store.load(hearts());
  applyColorway(store.design, pattern.colorways[5]);
  store.design.slots[1].code = 'DB0727';
  assert.equal(store.open(patternById('zigzag').make()), true);
  assert.equal(draftList().length, 1);
});

test('drafts stay few, however much gets tried', () => {
  for (let i = 0; i < DRAFT_LIMIT + 4; i++) {
    store.load(hearts());
    store.design.note = `Pokus ${i}`;
    store.open(patternById('zigzag').make());
  }
  const drafts = draftList();
  assert.equal(drafts.length, DRAFT_LIMIT);
  assert.equal(decodeDesign(drafts[0].data).note, `Pokus ${DRAFT_LIMIT + 3}`, 'the newest stay');
  assert.equal(savedList().length, 0);
});

test('the same work is not kept twice', () => {
  for (let i = 0; i < 3; i++) {
    store.load(hearts());
    store.design.note = 'Pořád to samé';
    store.open(patternById('zigzag').make());
  }
  assert.equal(draftList().length, 1);
});

test('opening a saved design shows what was saved, and edits made to it wait as a draft', () => {
  saveCurrent();
  const id = store.savedId;
  const saved = () => decodeDesign(savedList()[0].data);
  const original = saved().slots[1].code;
  const same = store.design;
  assert.equal(store.open(saved(), { savedId: id }), false, 'nothing changed, nothing to do');
  assert.equal(store.design, same);

  store.design.slots[1].code = 'DB0721';
  assert.equal(store.open(saved(), { savedId: id }), true);
  assert.equal(store.design.slots[1].code, original);
  assert.equal(store.savedId, id);
  assert.equal(store.isDirty(), false);
  assert.equal(saved().slots[1].code, original);
  assert.equal(decodeDesign(draftList()[0].data).slots[1].code, 'DB0721');
});

test('leaving a saved design with changes does not touch what was saved', () => {
  saveCurrent();
  const id = store.savedId;
  const original = savedList()[0].data;
  store.design.slots[1].code = 'DB0721';
  store.open(patternById('zigzag').make());
  assert.equal(savedList()[0].data, original);
  const [draft] = draftList();
  assert.equal(draft.savedId, id);

  // Carrying on with the draft brings the changes back, and saving updates the original.
  openDraft(draft.id);
  assert.equal(draftList().length, 0);
  assert.equal(store.design.slots[1].code, 'DB0721');
  assert.equal(store.savedId, id);
  assert.equal(store.isDirty(), true);
  saveCurrent();
  const list = savedList();
  assert.equal(list.length, 1);
  assert.equal(decodeDesign(list[0].data).slots[1].code, 'DB0721');
  assert.equal(store.isDirty(), false);
});

test('a draft of the saved design being edited still opens', () => {
  saveCurrent();
  store.design.slots[1].code = 'DB0721';
  store.open(patternById('zigzag').make());
  const { id, savedId } = draftList()[0];
  store.open(decodeDesign(savedList()[0].data), { savedId });
  assert.equal(store.design.slots[1].code === 'DB0721', false);
  openDraft(id);
  assert.equal(store.design.slots[1].code, 'DB0721');
});

test('a draft can be saved or thrown away from the list', () => {
  store.design.note = 'K uložení';
  store.open(patternById('zigzag').make());
  store.load(hearts());
  store.design.note = 'K zahození';
  store.open(patternById('zigzag').make());
  const [drop, keep] = draftList();
  deleteDraft(drop.id);
  assert.equal(saveDraft(keep.id), '4 srdíčka');
  assert.equal(draftList().length, 0);
  assert.equal(decodeDesign(savedList()[0].data).note, 'K uložení');
  assert.equal(saveDraft('neni'), null);
  assert.equal(openDraft('neni'), false);
});

test('all saved designs can go at once, and the one on screen stays', () => {
  saveCurrent();
  store.design.name = 'Druhý';
  store.savedId = null;
  saveCurrent();
  assert.equal(savedList().length, 2);
  deleteAllSaved();
  assert.equal(savedList().length, 0);
  assert.equal(store.savedId, null);
  assert.equal(store.design.name, 'Druhý');
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

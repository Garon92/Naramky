// The design being edited, its undo history, and what is kept in this browser.
// Nothing leaves the browser on its own. A link carries a design only when someone sends it.
import { clone, encodeDesign, decodeDesign, groupsOf, applyColorway } from '../core/design.js';
import { patternById, DEFAULT_PATTERN } from '../core/presets.js';
import { encodeShare } from '../core/link.js';
import { safeStorage } from './util.js';

const CURRENT = 'naramky:current';
const CURRENT_META = 'naramky:current-meta';
const SAVED = 'naramky:saved';
const DRAFTS = 'naramky:drafts';
const DRAFT_LIMIT = 6;
const HISTORY_LIMIT = 60;

const listeners = new Set();

export const store = {
  design: null,
  selected: 0,
  allInGroup: false, // colours go to every object of the selected slot's group
  savedId: null, // the entry in Moje návrhy this design belongs to, if any
  baseline: null, // the design as last saved or opened, to spot unsaved changes
  past: [],
  future: [],

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // kind: 'load', 'undo', 'geometry' (reframe), 'structure', 'color', 'meta', 'text'.
  notify(kind) {
    for (const fn of listeners) fn(kind);
    scheduleAutosave();
  },

  load(design, { savedId = null, baseline } = {}) {
    this.design = design;
    this.savedId = savedId;
    this.baseline = baseline ?? encodeDesign(design);
    // Start on the first kind of object that has several members, like the hearts.
    const groups = groupsOf(design);
    const main = groups.find((g) => g.slots.length > 1) ?? groups[Math.min(1, groups.length - 1)];
    this.selected = main.slots[0];
    this.allInGroup = false;
    this.past = [];
    this.future = [];
    this.notify('load');
  },

  // Replaces the design without losing work. Says whether unsaved changes became a draft.
  open(design, { savedId = null } = {}) {
    if (savedId && savedId === this.savedId && !this.isDirty()) return false; // already on screen
    const kept = keepDraft();
    this.load(design, { savedId });
    return kept;
  },

  isDirty() {
    return !!this.design && encodeDesign(this.design) !== this.baseline;
  },

  snapshot() {
    this.past.push(clone(this.design));
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  },

  undo() {
    if (!this.past.length) return false;
    this.future.push(clone(this.design));
    this.design = this.past.pop();
    this.selected = Math.min(this.selected, this.design.slots.length - 1);
    this.notify('undo');
    return true;
  },

  redo() {
    if (!this.future.length) return false;
    this.past.push(clone(this.design));
    this.design = this.future.pop();
    this.selected = Math.min(this.selected, this.design.slots.length - 1);
    this.notify('undo');
    return true;
  },
};

function writeCurrent() {
  if (!store.design) return;
  safeStorage.set(CURRENT, encodeDesign(store.design));
  safeStorage.set(CURRENT_META, JSON.stringify({ savedId: store.savedId, base: store.baseline }));
}

let saveTimer;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeCurrent, 400);
}

// Picks up where the last visit ended, unsaved changes included.
export function restoreSession() {
  if (typeof window !== 'undefined') window.addEventListener('pagehide', writeCurrent);
  const data = safeStorage.get(CURRENT);
  if (data) {
    try {
      const design = decodeDesign(data);
      const meta = JSON.parse(safeStorage.get(CURRENT_META) ?? '{}');
      store.load(design, { savedId: meta.savedId ?? null, baseline: meta.base ?? data });
      return;
    } catch {
      // An older or damaged autosave is not worth an error on first paint.
    }
  }
  store.load(patternById(DEFAULT_PATTERN).make());
}

const appUrl = () => `${location.origin}${location.pathname}`;

export const NO_LINK = 'Tenhle návrh je ze starší verze webu, takže ho odkazem sdílet nejde.';

// Null for a design whose pattern is no longer on the site.
export function shareLink(design) {
  const code = encodeShare(design);
  return code && `${appUrl()}#/n/${code}`;
}
export const linkFromData = (data) => shareLink(decodeDesign(data));

// --- Saved designs ---

export function savedList() {
  try {
    const list = JSON.parse(safeStorage.get(SAVED) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const writeList = (list) => safeStorage.set(SAVED, JSON.stringify(list));
const newId = () => `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function uniqueName(list, name, ignoreId) {
  const taken = new Set(list.filter((x) => x.id !== ignoreId).map((x) => x.name));
  if (!taken.has(name)) return name;
  let i = 2;
  while (taken.has(`${name} ${i}`)) i++;
  return `${name} ${i}`;
}

// Writes a design into its own entry, or a new one. Two designs never share an entry, even
// when they carry the same name.
function writeEntry(d, entryId) {
  const list = savedList();
  const existing = list.find((x) => x.id === entryId);
  d.name = uniqueName(list, d.name, existing?.id);
  const entry = { id: existing?.id ?? newId(), name: d.name, data: encodeDesign(d), at: Date.now() };
  return { ok: writeList([entry, ...list.filter((x) => x.id !== entry.id)]), entry };
}

// The saved design that saving would change, or null when saving makes a new one.
export function savedTarget() {
  if (!store.savedId || !store.isDirty()) return null;
  return savedList().find((x) => x.id === store.savedId) ?? null;
}

// asNew leaves the saved design as it was and puts the changes next to it.
export function saveCurrent({ asNew = false } = {}) {
  const { ok, entry } = writeEntry(store.design, asNew ? null : store.savedId);
  if (ok) {
    store.savedId = entry.id;
    store.baseline = entry.data;
    writeCurrent();
  }
  return { ok, name: entry.name };
}

// A colourway picked from a pattern and left as it was can simply be picked again.
function isUntouchedPreset(d) {
  const pattern = patternById(d.preset);
  const way = pattern?.colorways.find((w) => w.name === d.colorway);
  if (!way) return false;
  const fresh = pattern.make();
  applyColorway(fresh, way);
  return encodeDesign(fresh) === encodeDesign(d);
}

export function duplicateSaved(id) {
  const list = savedList();
  const item = list.find((x) => x.id === id);
  if (!item) return false;
  const d = decodeDesign(item.data);
  d.name = uniqueName(list, `${item.name} kopie`);
  return writeList([{ id: newId(), name: d.name, data: encodeDesign(d), at: Date.now() }, ...list]);
}

export function deleteSaved(id) {
  writeList(savedList().filter((x) => x.id !== id));
  if (store.savedId === id) store.savedId = null;
}

export function deleteAllSaved() {
  writeList([]);
  store.savedId = null;
}

// --- Drafts ---
// Saved designs are only what someone chose to save. Changes left behind by opening something
// else wait here instead, so trying things out fills nothing up: the oldest simply drop off.

export const DRAFT_NOTE = 'Neuložené změny čekají v Moje návrhy v části Rozpracované. Uložené návrhy se nezměnily.';
export { DRAFT_LIMIT };

export function draftList() {
  try {
    const list = JSON.parse(safeStorage.get(DRAFTS) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const writeDrafts = (list) => safeStorage.set(DRAFTS, JSON.stringify(list));

function keepDraft() {
  const d = store.design;
  if (!d || !store.isDirty() || (!store.savedId && isUntouchedPreset(d))) return false;
  const data = encodeDesign(d);
  const entry = { id: newId(), name: d.name, data, savedId: store.savedId, base: store.baseline, at: Date.now() };
  return writeDrafts([entry, ...draftList().filter((x) => x.data !== data)].slice(0, DRAFT_LIMIT));
}

// Carries on with a draft. It knows the saved design it came from, so saving updates that one.
export function openDraft(id) {
  const item = draftList().find((x) => x.id === id);
  if (!item) return false;
  const kept = keepDraft();
  store.load(decodeDesign(item.data), { savedId: item.savedId, baseline: item.base });
  writeDrafts(draftList().filter((x) => x.id !== id));
  return kept;
}

export function saveDraft(id) {
  const drafts = draftList();
  const item = drafts.find((x) => x.id === id);
  if (!item) return null;
  const { ok, entry } = writeEntry(decodeDesign(item.data), item.savedId);
  if (ok) writeDrafts(drafts.filter((x) => x.id !== id));
  return ok ? entry.name : null;
}

export const deleteDraft = (id) => writeDrafts(draftList().filter((x) => x.id !== id));

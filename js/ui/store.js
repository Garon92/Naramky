// The design being edited, its undo history, and what is kept in this browser.
// Nothing leaves the browser on its own. A link carries a design only when someone sends it.
import { clone, encodeDesign, decodeDesign, groupsOf, applyColorway } from '../core/design.js';
import { patternById, DEFAULT_PATTERN } from '../core/presets.js';
import { safeStorage } from './util.js';

const CURRENT = 'naramky:current';
const CURRENT_META = 'naramky:current-meta';
const SAVED = 'naramky:saved';
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

  // Replaces the design without losing work. Returns the name it was kept under.
  open(design, { savedId = null } = {}) {
    if (savedId && savedId === this.savedId) return null; // already being edited
    const kept = keepUnsaved();
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

export const shareLink = (design) => `${appUrl()}#/n/${encodeDesign(design)}`;
export const linkFromData = (data) => `${appUrl()}#/n/${data}`;

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

// Saves into the design's own entry, or a new one. Two designs never share an entry,
// even when they carry the same name.
export function saveCurrent() {
  const list = savedList();
  const d = store.design;
  const existing = list.find((x) => x.id === store.savedId);
  d.name = uniqueName(list, d.name, existing?.id);
  const entry = { id: existing?.id ?? newId(), name: d.name, data: encodeDesign(d), at: Date.now() };
  const ok = writeList([entry, ...list.filter((x) => x.id !== entry.id)]);
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

function keepUnsaved() {
  const d = store.design;
  if (!store.isDirty() || (!store.savedId && isUntouchedPreset(d))) return null;
  const { ok, name } = saveCurrent();
  return ok ? name : null;
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

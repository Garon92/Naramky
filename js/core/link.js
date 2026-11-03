// Share links. A design almost always is "this pattern, these colours", so a link names
// the pattern and carries only what differs from it:
//   pattern . colourway . colours . other changes . changed beads
import { b64, clone, applyColorway, EXTRA_GROUP } from './design.js';
import { czName } from './catalog.js';
import { patternById } from './presets.js';
import { generate, NONE } from '../techniques/peyote.js';

const toToken = (code) => code.replace(/^DB/, '').replace('-', '_');
const toCode = (token) => (/^\d/.test(token) ? `DB${token}` : token.replace('_', '-'));

function packColors(slots) {
  const out = [];
  for (const { code } of slots) {
    const token = toToken(code);
    const last = out[out.length - 1];
    if (last && last.token === token) last.count++;
    else out.push({ token, count: 1 });
  }
  return out.map((x) => (x.count > 1 ? `${x.token}x${x.count}` : x.token)).join('-');
}

function unpackColors(text) {
  return text.split('-').filter(Boolean).flatMap((item) => {
    const [token, count] = item.split('x');
    return Array(Number(count ?? 1)).fill(toCode(token));
  });
}

// Beads that differ from what the pattern generates: gap, optional length, slot.
function packCells(cells, original) {
  const runs = [];
  let end = 0;
  let i = 0;
  while (i < cells.length) {
    if (cells[i] === original[i]) {
      i++;
      continue;
    }
    let len = 1;
    while (i + len < cells.length && cells[i + len] === cells[i] && cells[i + len] !== original[i + len]) len++;
    const slot = cells[i] === NONE ? 'zz' : cells[i].toString(36);
    const gap = (i - end).toString(36);
    runs.push(len > 1 ? `${gap}-${len.toString(36)}-${slot}` : `${gap}-${slot}`);
    i += len;
    end = i;
  }
  return runs.join('_');
}

function unpackCells(text, original) {
  const cells = original.slice();
  let at = 0;
  for (const run of text.split('_').filter(Boolean)) {
    const tokens = run.split('-');
    const gap = parseInt(tokens[0], 36);
    const len = tokens.length === 3 ? parseInt(tokens[1], 36) : 1;
    const slotToken = tokens[tokens.length - 1];
    const slot = slotToken === 'zz' ? NONE : parseInt(slotToken, 36);
    at += gap;
    if (!Number.isFinite(at) || !Number.isFinite(slot) || at + len > cells.length) throw new Error('Poškozený vzor');
    cells.fill(slot, at, at + len);
    at += len;
  }
  return cells;
}

// Pictures repeat, and a drawn one holds its whole shape in its id, so a list stores each once.
const FIGURE_LISTS = ['seq', 'items'];

function packFigures(list) {
  const unique = [...new Set(list)];
  return { u: unique, at: list.map((id) => unique.indexOf(id)) };
}

function paramsDelta(params, base) {
  const delta = {};
  const removed = [];
  for (const key of new Set([...Object.keys(params), ...Object.keys(base)])) {
    if (!(key in params)) removed.push(key);
    else if (JSON.stringify(params[key]) !== JSON.stringify(base[key])) delta[key] = FIGURE_LISTS.includes(key) ? packFigures(params[key]) : params[key];
  }
  if (removed.length) delta._removed = removed;
  return Object.keys(delta).length ? delta : null;
}

function applyDelta(params, delta) {
  const { _removed = [], ...rest } = delta;
  const out = { ...params, ...rest };
  for (const key of FIGURE_LISTS) if (rest[key]) out[key] = rest[key].at.map((i) => rest[key].u[i]);
  for (const key of _removed) delete out[key];
  return out;
}

function checkSize(params) {
  if ((params.w ?? 0) > 64 || (params.n ?? 0) > 800) throw new Error('Příliš velký vzor');
}

// Null when the design's pattern is no longer on the site.
export function encodeShare(d) {
  const pattern = patternById(d.preset);
  if (!pattern) return null;
  const base = pattern.make();

  const wayIndex = pattern.colorways.findIndex((w) => w.name === d.colorway);
  const reference = clone(base);
  if (wayIndex >= 0) applyColorway(reference, pattern.colorways[wayIndex]);

  const meta = {};
  if (d.name !== base.name) meta.n = d.name;
  if (d.note) meta.o = d.note;
  if (d.wrist !== base.wrist) meta.w = d.wrist;
  if (d.metal !== (wayIndex >= 0 ? reference.metal : base.metal)) meta.m = d.metal;
  if (d.surface !== base.surface) meta.f = d.surface;
  if (d.pose) meta.a = d.pose;
  const deltas = d.parts.map((part, i) => paramsDelta(part.params, base.parts[i].params));
  if (deltas.some(Boolean)) meta.p = deltas;

  const rebuilt = rebuild(pattern, deltas);
  const labels = {};
  d.slots.forEach((slot, i) => {
    const expected = rebuilt.slots[i];
    if (slot.group === EXTRA_GROUP && slot.label === czName(slot.code)) return;
    if (!expected || expected.label !== slot.label || expected.group !== slot.group) labels[i] = slot.group === slot.label ? slot.label : [slot.label, slot.group];
  });
  if (Object.keys(labels).length) meta.l = labels;

  const sameColors = !deltas.some(Boolean) && d.slots.length === reference.slots.length
    && d.slots.every((slot, i) => slot.code === reference.slots[i].code);
  const colors = sameColors ? '' : packColors(d.slots);

  const cells = d.parts.map((part) => (part.tech === 'peyote' && part.cells ? packCells(part.cells, generate(part.params).cells) : ''));
  const sections = [
    d.preset,
    wayIndex >= 0 ? wayIndex.toString(36) : '',
    colors,
    Object.keys(meta).length ? b64.encode(JSON.stringify(meta)) : '',
    cells.some(Boolean) ? cells.join('~') : '',
  ];
  while (sections.length > 1 && !sections[sections.length - 1]) sections.pop();
  return sections.join('.');
}

// A fresh design of this pattern with the same parameters. Slots follow the parameters.
function rebuild(pattern, deltas) {
  const d = pattern.make();
  d.parts.forEach((part, i) => {
    if (deltas?.[i]) part.params = applyDelta(part.params, deltas[i]);
    checkSize(part.params);
  });
  const first = d.parts[0];
  if (deltas?.some(Boolean) && first.tech === 'peyote' && d.parts.length === 1) {
    const roles = generate(first.params).roles;
    const code = d.slots[0].code;
    d.slots = roles.map((role) => ({ ...role, code }));
  }
  return d;
}

export function decodeShare(text) {
  const [id, way, colors, metaText, cellsText] = text.split('.');
  const pattern = patternById(id);
  if (!pattern) throw new Error('Neznámý vzor');
  const meta = metaText ? JSON.parse(b64.decode(metaText)) : {};
  const d = rebuild(pattern, meta.p);
  if (way) {
    const colorway = pattern.colorways[parseInt(way, 36)];
    if (!colorway) throw new Error('Neznámá kombinace');
    applyColorway(d, colorway);
  } else {
    d.colorway = null;
  }
  if (colors) {
    unpackColors(colors).forEach((code, i) => {
      if (!d.slots[i]) d.slots[i] = { label: czName(code), group: EXTRA_GROUP, code };
      d.slots[i].code = code;
    });
    d.slots.forEach((slot) => {
      if (slot.group === EXTRA_GROUP) slot.label = czName(slot.code);
    });
  }
  for (const [index, value] of Object.entries(meta.l ?? {})) {
    const [label, group] = Array.isArray(value) ? value : [value, value];
    if (d.slots[index]) Object.assign(d.slots[index], { label: String(label).slice(0, 40), group: String(group).slice(0, 40) });
  }
  if (meta.n) d.name = String(meta.n).slice(0, 80);
  if (meta.o) d.note = String(meta.o).slice(0, 500);
  if (meta.w) d.wrist = Number(meta.w) || d.wrist;
  if (meta.m) d.metal = meta.m;
  if (meta.f) d.surface = meta.f;
  if (meta.a) d.pose = meta.a;
  if (cellsText) {
    cellsText.split('~').forEach((part, i) => {
      if (part && d.parts[i]?.tech === 'peyote') d.parts[i].cells = unpackCells(part, generate(d.parts[i].params).cells);
    });
  }
  return d;
}

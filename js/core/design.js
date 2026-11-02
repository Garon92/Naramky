// A design is a list of parts (one bracelet, or several in a set) that share colour
// slots. Each part names its technique. New techniques plug in here.
import * as peyote from '../techniques/peyote.js';
import * as tila from '../techniques/tila.js';
import * as strand from '../techniques/strand.js';
import { bead, codeOf, hasBead } from './catalog.js';
import { parseMotif } from './motifs.js';

export const TECHNIQUES = {
  peyote: { label: 'Šitý pás Delica', mod: peyote, paint: true },
  tila: { label: 'Šitý zig-zag', mod: tila },
  strand: { label: 'Navlékaný', mod: strand },
};

const techOf = (part) => TECHNIQUES[part.tech].mod;

export const WRIST_DEFAULT = 16;
// Clasp, rings and tab take this much of the wrist measurement.
export const FINDINGS_MM = 27;

export function bandLengthMm(wristCm) {
  return wristCm * 10 - FINDINGS_MM;
}

// Columns needed for a wrist. Along the band each bead takes its diameter.
export function colsForWrist(wristCm, beadDiameter) {
  return Math.max(16, Math.round(bandLengthMm(wristCm) / beadDiameter));
}

export function makeDesign({ name, slots, parts, metal = 'steel', surface = 'backdrop', wrist = WRIST_DEFAULT, note = '', preset = null, pose }) {
  return {
    v: 2, name, note, wrist, metal, surface, preset, pose, colorway: null,
    slots: slots.map((s) => ({ label: s.label, group: s.group ?? s.label, code: codeOf(s.code) })),
    parts,
  };
}

export const clone = (d) => ({
  ...d,
  slots: d.slots.map((s) => ({ ...s })),
  parts: d.parts.map((p) => ({
    ...p,
    params: JSON.parse(JSON.stringify(p.params)),
    cells: p.cells ? p.cells.slice() : null,
  })),
});

export const paintablePart = (d) => d.parts.find((p) => TECHNIQUES[p.tech].paint);

// Keeps the pattern centred, cutting or adding background at both ends.
function resizeCells(cells, w, oldN, newN) {
  const out = new Uint8Array(w * newN);
  const shift = Math.floor((newN - oldN) / 2);
  for (let r = 0; r < w; r++) {
    for (let c = 0; c < oldN; c++) {
      const nc = c + shift;
      if (nc >= 0 && nc < newN) out[r * newN + nc] = cells[r * oldN + c];
    }
  }
  return out;
}

// Slots that share a group are the same kind of object, like all hearts on a band.
export function groupsOf(d) {
  const map = new Map();
  d.slots.forEach((slot, i) => {
    const name = slot.group ?? slot.label;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(i);
  });
  return [...map.entries()].map(([name, slots]) => ({ name, slots }));
}

export const groupOfSlot = (d, i) => groupsOf(d).find((g) => g.slots.includes(i));

// One colour on every object of a group.
export function setGroupColor(d, slotIndex, code) {
  for (const i of groupOfSlot(d, slotIndex).slots) d.slots[i].code = code;
}

// A colourway only changes colours. colors maps a group to one code or a list by member.
export function applyColorway(d, colorway) {
  for (const { name, slots } of groupsOf(d)) {
    const value = colorway.colors[name];
    if (value === undefined) continue;
    slots.forEach((slotIndex, i) => {
      d.slots[slotIndex].code = codeOf(Array.isArray(value) ? value[i % value.length] : value);
    });
  }
  if (colorway.metal) d.metal = colorway.metal;
  d.colorway = colorway.name;
}

// Recolours one bead or tile. Sewn bands keep it in the cells, other techniques in a
// small override list, so any single object can differ from the rest of its group.
export function setBeadSlot(d, inst, slot) {
  const part = d.parts[inst.part];
  if (part.tech === 'peyote') {
    peyote.ensureCells(part)[inst.row * part.params.n + inst.col] = slot;
  } else {
    part.params.over = { ...(part.params.over ?? {}), [inst.index]: slot };
  }
}

export function addExtraColor(d, code) {
  const n = d.slots.filter((s) => s.group === 'Další barvy').length + 1;
  d.slots.push({ label: `Barva ${n}`, group: 'Další barvy', code });
  return d.slots.length - 1;
}

export function applyWrist(d, wrist) {
  d.wrist = wrist;
  for (const part of d.parts) {
    if (part.tech === 'peyote') {
      const n = colsForWrist(wrist, peyote.beadDims(part).D);
      if (part.cells) part.cells = resizeCells(part.cells, part.params.w, part.params.n, n);
      part.params.n = n;
    } else {
      part.params.lengthMm = bandLengthMm(wrist) + (part.tech === 'strand' ? 4 : 0);
    }
  }
}

const FRESH_COLORS = ['DB1138', 'DB2036', 'DB0658', 'DB2138', 'DB0721', 'DB2121', 'DB2035', 'DB1133', 'DB0726', 'DB0244', 'DB0729', 'DB1379'];

// Changing pattern settings regenerates the band. Colours and names stay with their
// objects, matched by group and by position inside the group.
export function applyMotifSettings(d, part, changes) {
  const p = part.params;
  const { motif, count, ...rest } = changes;
  const before = groupsOf(d);
  const old = d.slots.map((x) => ({ ...x }));
  Object.assign(p, rest);
  part.cells = null;
  if (rest.size !== undefined) p.n = colsForWrist(d.wrist, peyote.beadDims(part).D);
  if (p.kind !== 'motifs') return;
  if (motif) p.seq = p.seq.map(() => motif);
  if (count !== undefined) {
    const base = p.seq[0];
    p.seq = Array.from({ length: count }, (_, i) => p.seq[i] ?? base);
  }
  const rows = new Set(p.seq.map((id) => parseMotif(id).rows));
  if (rows.size === 1 && (p.w - [...rows][0]) % 2 !== 0) p.w += 1;
  const seen = new Map();
  let fresh = 0;
  d.slots = peyote.generate(p).roles.map((role) => {
    const position = seen.get(role.group) ?? 0;
    seen.set(role.group, position + 1);
    const prevGroup = before.find((g) => g.name === role.group);
    const prev = prevGroup ? old[prevGroup.slots[position]] : null;
    if (prev) return { ...prev };
    const sibling = prevGroup ? old[prevGroup.slots[0]] : null;
    const code = sibling && role.group !== 'Srdíčka' ? sibling.code : role.group === 'Konce' || role.group === 'Mezičlánky' ? 'DB0031' : FRESH_COLORS[fresh++ % FRESH_COLORS.length];
    return { ...role, code };
  });
}

// Turns a design into what the 3D stage draws. Parts lie side by side.
export function sceneSpec(d) {
  const built = d.parts.map((part) => ({ part, b: techOf(part).build(part) }));
  const spacing = 5;
  const total = built.reduce((sum, x) => sum + x.b.width, 0) + spacing * (built.length - 1);
  let cursor = -total / 2;
  const instances = [];
  let length = 0;
  let bed = null;
  built.forEach(({ b }, partIndex) => {
    const offset = cursor + b.width / 2;
    b.instances.forEach((inst, index) => {
      const slot = d.slots[inst.slot] ?? d.slots[0];
      const info = bead(slot.code);
      instances.push({ ...inst, t: inst.t + offset, hex: info.hex, finish: info.finish, part: partIndex, index });
    });
    if (b.bed && !bed) bed = { ...b.bed, tMin: b.bed.tMin + offset, tMax: b.bed.tMax + offset };
    cursor += b.width + spacing;
    length = Math.max(length, b.length);
  });
  const frameHeight = Math.max(total * 2.4, ...built.map((x) => x.b.frameHeight ?? 0));
  return {
    instances, length, width: total, bed, frameHeight,
    poseKind: d.pose,
    findings: { metal: d.metal, chainLinks: 18 },
  };
}

// Where the interesting part of the design lies, for the default camera.
export function focusSpan(d) {
  const p = d.parts[0];
  if (p.tech === 'peyote' && p.params.kind === 'motifs') {
    const m = peyote.grid(p);
    let min = Infinity;
    let max = -Infinity;
    const { D } = peyote.beadDims(p);
    for (let r = 0; r < m.w; r++) {
      for (let c = 0; c < m.n; c++) {
        const slot = m.cells[r * m.n + c];
        if (slot >= 1 && slot <= p.params.seq.length) {
          min = Math.min(min, c);
          max = Math.max(max, c);
        }
      }
    }
    if (min < Infinity) return { center: ((min + max) / 2 - (m.n - 1) / 2) * D, span: (max - min + 6) * D };
  }
  return null;
}

export function materials(d) {
  const lines = new Map();
  for (const part of d.parts) {
    for (const { slot, count, shape, perGram, material } of techOf(part).counts(part)) {
      const code = d.slots[slot]?.code ?? d.slots[0].code;
      const key = `${material}|${code}`;
      const prev = lines.get(key) ?? { material, code, shape, count: 0, perGram, labels: new Set() };
      prev.count += count;
      const lab = d.slots[slot]?.label;
      if (lab) prev.labels.add(lab);
      lines.set(key, prev);
    }
  }
  return [...lines.values()]
    .map((l) => ({ ...l, labels: [...l.labels], grams: l.count / l.perGram }))
    .sort((a, b) => b.count - a.count);
}

// --- Sharing: everything fits in the URL fragment, which never reaches a server. ---

const RLE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function cellsToText(cells) {
  let out = '';
  let i = 0;
  while (i < cells.length) {
    const v = cells[i];
    let run = 1;
    while (i + run < cells.length && cells[i + run] === v) run++;
    out += `${v === peyote.NONE ? 'z' : RLE_ALPHABET[v]}${run.toString(36)}.`;
    i += run;
  }
  return out;
}

function textToCells(text, size) {
  const cells = new Uint8Array(size);
  let at = 0;
  for (const token of text.split('.')) {
    if (!token) continue;
    const v = token[0] === 'z' ? peyote.NONE : RLE_ALPHABET.indexOf(token[0]);
    const run = parseInt(token.slice(1), 36);
    if (v < 0 || !Number.isFinite(run) || at + run > size) throw new Error('Poškozený vzor');
    cells.fill(v, at, at + run);
    at += run;
  }
  return cells;
}

const b64 = {
  encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

export function encodeDesign(d) {
  const data = {
    v: 2, n: d.name, o: d.note || undefined, w: d.wrist, m: d.metal, f: d.surface, r: d.preset || undefined, y: d.colorway || undefined, a: d.pose,
    s: d.slots.map((s) => (s.group && s.group !== s.label ? [s.label, s.code, s.group] : [s.label, s.code])),
    p: d.parts.map((p) => ({ t: p.tech, a: p.params, c: p.cells ? cellsToText(p.cells) : undefined })),
  };
  return b64.encode(JSON.stringify(data));
}

export function decodeDesign(text) {
  const data = JSON.parse(b64.decode(text));
  if (data.v !== 2 || !Array.isArray(data.p) || !Array.isArray(data.s)) throw new Error('Neznámý formát návrhu');
  const slots = data.s.map(([label, code, group]) => {
    if (!hasBead(code)) throw new Error(`Neznámá barva ${code}`);
    const name = String(label).slice(0, 40);
    return { label: name, code, group: group ? String(group).slice(0, 40) : name };
  });
  const parts = data.p.map((p) => {
    if (!TECHNIQUES[p.t]) throw new Error('Neznámá technika');
    const part = { tech: p.t, params: p.a, cells: null };
    if (p.c) part.cells = textToCells(p.c, p.a.w * p.a.n);
    return part;
  });
  return {
    v: 2, name: String(data.n ?? 'Návrh').slice(0, 80), note: String(data.o ?? '').slice(0, 500), colorway: data.y ?? null,
    wrist: Number(data.w) || WRIST_DEFAULT, metal: data.m ?? 'steel', surface: data.f ?? 'backdrop',
    preset: data.r ?? null, pose: data.a, slots, parts,
  };
}

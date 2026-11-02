// A design is a list of parts (one bracelet, or several in a set) that share colour
// slots. Each part names its technique. New techniques plug in here.
import * as peyote from '../techniques/peyote.js';
import * as tila from '../techniques/tila.js';
import * as strand from '../techniques/strand.js';
import * as weaves from '../techniques/weaves.js';
import { SHAPES, reach } from './shapes.js';
import { bead, codeOf, hasBead, czName } from './catalog.js';
import { parseMotif } from './motifs.js';

export const TECHNIQUES = {
  peyote: { label: 'Šitý pás Delica', mod: peyote, paint: true },
  tila: { label: 'Šitý zig-zag', mod: tila },
  strand: { label: 'Navlékaný', mod: strand },
  herringbone: { label: 'Rybí kost', mod: weaves.herringbone },
  raw: { label: 'Pravoúhlé tkaní', mod: weaves.raw },
  spiral: { label: 'Spirálový provaz', mod: weaves.spiral },
  rope: { label: 'Háčkovaný provaz', mod: weaves.rope },
  daisy: { label: 'Kytičkový řetěz', mod: weaves.daisy },
  net: { label: 'Síťka', mod: weaves.net },
  petersburg: { label: 'Petrohradský řetěz', mod: weaves.petersburg },
  macrame: { label: 'Makramé s kuličkami', mod: weaves.macrame },
  fringe: { label: 'Střapatý provaz', mod: weaves.fringe },
  tilagrid: { label: 'Mozaika z Tila', mod: weaves.tilagrid },
  ladder: { label: 'Žebříček z tyčinek', mod: weaves.ladder },
  buglezig: { label: 'Cik-cak z tyčinek', mod: weaves.buglezig },
  letters: { label: 'Kostky s písmeny', mod: weaves.letters },
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

export function makeDesign({ name, slots, parts, metal = 'steel', surface = 'white', wrist = WRIST_DEFAULT, note = '', preset = null, pose }) {
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

// Beads recoloured one by one keep their colours in slots of this group. The group
// only exists while some bead uses it.
export const EXTRA_GROUP = 'Přebarvené kusy';

export function extraSlotFor(d, code) {
  const found = d.slots.findIndex((x) => x.group === EXTRA_GROUP && x.code === code);
  if (found >= 0) return found;
  d.slots.push({ label: czName(code), group: EXTRA_GROUP, code });
  return d.slots.length - 1;
}

function usedSlots(d) {
  const used = new Set();
  for (const part of d.parts) for (const b of techOf(part).build(part).instances) used.add(b.slot);
  return used;
}

// Drops colours no bead uses any more, and renumbers everything after them.
export function pruneExtras(d) {
  const used = usedSlots(d);
  const remap = new Map();
  const next = [];
  d.slots.forEach((slot, i) => {
    if (slot.group === EXTRA_GROUP && !used.has(i)) return;
    remap.set(i, next.length);
    next.push(slot);
  });
  if (next.length === d.slots.length) return remap;
  d.slots = next;
  for (const part of d.parts) {
    if (part.cells) part.cells = part.cells.map((v) => (v === peyote.NONE ? v : remap.get(v) ?? 0));
    if (part.params.over) {
      part.params.over = Object.fromEntries(Object.entries(part.params.over).map(([k, v]) => [k, remap.get(v) ?? 0]));
    }
    for (const strandItem of part.params.strands ?? []) for (const item of strandItem.seq) item[0] = remap.get(item[0]) ?? 0;
  }
  return remap;
}

// Puts one bead back to what the pattern itself says.
export function resetBead(d, inst) {
  const part = d.parts[inst.part];
  if (part.tech === 'peyote') {
    const index = inst.row * part.params.n + inst.col;
    peyote.ensureCells(part)[index] = peyote.generate(part.params).cells[index];
  } else if (part.params.over) {
    const { [inst.index]: _, ...rest } = part.params.over;
    part.params.over = rest;
  }
}

// Removes a colour used for single beads: they all return to the pattern.
export function removeExtraColor(d, slot) {
  for (const part of d.parts) {
    if (part.tech === 'peyote' && part.cells) {
      const original = peyote.generate(part.params).cells;
      part.cells = part.cells.map((v, i) => (v === slot ? original[i] : v));
    } else if (part.params.over) {
      part.params.over = Object.fromEntries(Object.entries(part.params.over).filter(([, v]) => v !== slot));
    }
  }
  pruneExtras(d);
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
  const decals = [];
  let length = 0;
  let bed = null;
  let lift = 0.75;
  let noClasp = false;
  built.forEach(({ b }, partIndex) => {
    const offset = cursor + b.width / 2;
    b.instances.forEach((inst, index) => {
      const slot = d.slots[inst.slot] ?? d.slots[0];
      const info = bead(slot.code);
      instances.push({ ...inst, t: inst.t + offset, hex: info.hex, finish: SHAPES[inst.shape].finish ?? info.finish, part: partIndex, index });
      lift = Math.max(lift, Math.abs(inst.h ?? 0) + reach(inst.shape));
    });
    for (const mark of b.decals ?? []) decals.push({ ...mark, t: mark.t + offset, hex: bead(d.slots[mark.slot].code).hex });
    if (b.noClasp) noClasp = true;
    if (b.bed && !bed) bed = { ...b.bed, tMin: b.bed.tMin + offset, tMax: b.bed.tMax + offset };
    cursor += b.width + spacing;
    length = Math.max(length, b.length);
  });
  const frameHeight = Math.max(total * 2.4, ...built.map((x) => x.b.frameHeight ?? 0));
  return {
    instances, decals, length, width: total, bed, frameHeight, lift,
    poseKind: d.pose,
    findings: noClasp ? null : { metal: d.metal, chainLinks: 18 },
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
    for (const { slot, count, shape, perGram, material, noCount } of techOf(part).counts(part)) {
      const code = d.slots[slot]?.code ?? d.slots[0].code;
      const key = `${material}|${code}`;
      const prev = lines.get(key) ?? { material, code, shape, count: 0, perGram, noCount, labels: new Set() };
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

export const b64 = {
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
    if ((p.a?.w ?? 0) > 64 || (p.a?.n ?? 0) > 800) throw new Error('Příliš velký vzor');
    const part = { tech: p.t, params: p.a, cells: null };
    if (p.c) part.cells = textToCells(p.c, p.a.w * p.a.n);
    return part;
  });
  return {
    v: 2, name: String(data.n ?? 'Návrh').slice(0, 80), note: String(data.o ?? '').slice(0, 500), colorway: data.y ?? null,
    wrist: Number(data.w) || WRIST_DEFAULT, metal: data.m ?? 'steel', surface: data.f ?? 'white',
    preset: data.r ?? null, pose: data.a, slots, parts,
  };
}

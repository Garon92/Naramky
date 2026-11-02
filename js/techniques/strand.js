// Strung bracelets. One to several strands, each a repeating sequence of beads.
// A sequence item is [slot, count, shape?]. Default shape is an 11/0 seed bead.
import { SHAPES } from '../core/shapes.js';

const DEFAULT_SHAPE = 'rocaille11';
const GAP_BETWEEN = 3.3;

function advance(shape) {
  const def = SHAPES[shape];
  if (def.kind === 'delica') return def.size[1];
  if (def.kind === 'tile') return def.size[1];
  if (def.kind === 'cube') return def.size[0] * 1.02;
  if (def.kind === 'bugle' || def.kind === 'bicone') return def.size[1] * 1.02;
  if (def.kind === 'round') return def.size[0] * 0.98;
  return def.size[1] * 0.98;
}

const perGram = (shape) => SHAPES[shape]?.perGram ?? 100;
const materialName = (shape) => SHAPES[shape]?.label ?? shape;

export function strandBeads(strand, lengthMm) {
  const out = [];
  let s = 0;
  let guard = 0;
  const seq = strand.seq;
  while (s < lengthMm && guard++ < 4000) {
    for (const [slot, count, shape = DEFAULT_SHAPE] of seq) {
      for (let i = 0; i < count && s < lengthMm; i++) {
        const a = advance(shape);
        out.push({ slot, shape, s: s + a / 2 });
        s += a;
      }
      if (s >= lengthMm) break;
    }
  }
  return { beads: out, used: s };
}

export function build(part) {
  const p = part.params;
  const len = p.lengthMm ?? 150;
  const strands = p.strands;
  const instances = [];
  const count = strands.length;
  const totalWidth = (count - 1) * GAP_BETWEEN + 3;
  strands.forEach((strand, i) => {
    const { beads, used } = strandBeads(strand, strand.lengthMm ?? len);
    const t = (i - (count - 1) / 2) * GAP_BETWEEN;
    // Each strand starts at its own phase, and a lazy wander keeps it from being ruler-straight.
    for (const b of beads) {
      const s = b.s - used / 2;
      const wander = Math.sin(s * 0.042 + i * 2.1) * 0.5;
      const def = SHAPES[b.shape];
      const inst = { shape: b.shape, slot: b.slot, s, t: t + wander };
      if (def.kind === 'delica' || def.kind === 'tile') inst.yaw = Math.PI / 2;
      instances.push(inst);
    }
  });
  for (const [index, slot] of Object.entries(p.over ?? {})) if (instances[index]) instances[index].slot = slot;
  return { instances, length: len, width: Math.max(totalWidth, 4), frameHeight: Math.max(26, totalWidth * 2.6) };
}

export function counts(part) {
  const map = new Map();
  for (const b of build(part).instances) {
    const k = `${b.slot}|${b.shape}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, count]) => {
    const [slot, shape] = k.split('|');
    return { slot: Number(slot), count, shape, perGram: perGram(shape), material: materialName(shape) };
  });
}

export const steps = (part) => {
  const n = part.params.strands.length;
  const lines = [`Technika: navlékání, ${n === 1 ? '1 pramen' : n < 5 ? `${n} prameny` : `${n} pramenů`}.`];
  part.params.strands.forEach((strand, i) => {
    lines.push({ strand: i, seq: strand.seq });
  });
  lines.push('Sekvenci opakuj, dokud nemáš požadovanou délku, a pak připoj komponenty.');
  return lines;
};

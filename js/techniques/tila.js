// Sewn herringbone of flat two-hole tiles with little arcs of seed beads along both
// edges. The layout is an approximation of how such a band is built.
const PITCH = 3.45;
const ARM = 1.95;
const ANGLE = Math.PI / 4;

function repeats(lengthMm) {
  return Math.max(6, Math.round(lengthMm / PITCH));
}

// Slots: 0 tile A, 1 tile B, 2 edge beads, 3 accent tile (optional).
export function build(part) {
  const p = part.params;
  const len = (p.lengthMm ?? 150);
  const count = repeats(len);
  const seed = p.edgeShape ?? 'rocaille15';
  const seedStep = 1.05;
  const instances = [];
  const half = ((count - 1) * PITCH) / 2;
  const accentEvery = p.accentEvery ?? 0;
  for (let i = 0; i < count; i++) {
    const s = i * PITCH - half;
    const isAccentA = accentEvery && i % accentEvery === Math.floor(accentEvery / 2);
    instances.push({ shape: 'halftila', slot: isAccentA && p.accentSide !== 'b' ? 3 : 0, s, t: -ARM, h: 0.12, yaw: ANGLE });
    instances.push({ shape: 'halftila', slot: isAccentA && p.accentSide === 'b' ? 3 : 1, s: s + PITCH * 0.5, t: ARM, h: -0.05, yaw: -ANGLE });
    // Edge arcs: three seed beads hugging the outer tip of each tile.
    for (const [side, off] of [[-1, 0], [1, PITCH * 0.5]]) {
      for (let k = -1; k <= 1; k++) {
        instances.push({
          shape: seed, slot: 2,
          s: s + off + k * seedStep + side * 0.62,
          t: side * (ARM + 2.32 - Math.abs(k) * 0.3),
          h: -0.18,
          yaw: k * 0.55 * side,
        });
      }
      instances.push({
        shape: seed, slot: 2,
        s: s + off + side * 0.62 + PITCH * 0.5 * 0.98,
        t: side * (ARM + 1.55),
        h: -0.25,
        yaw: side * 1.2,
      });
    }
  }
  for (const [index, slot] of Object.entries(p.over ?? {})) if (instances[index]) instances[index].slot = slot;
  const length = (count - 1) * PITCH + PITCH * 0.5 + 3;
  return { instances, length, width: 11, frameHeight: 34 };
}

export function counts(part) {
  const { instances } = build(part);
  const map = new Map();
  for (const b of instances) {
    const k = `${b.slot}|${b.shape}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, count]) => {
    const [slot, shape] = k.split('|');
    return {
      slot: Number(slot), count, shape,
      perGram: shape === 'halftila' ? 32 : 240,
      material: shape === 'halftila' ? 'Half Tila 5 mm' : 'Rokajl 15/0',
    };
  });
}

export const steps = () => [
  'Technika: šitý řetěz z dvoudírkových korálků (Half Tila) s rokajly na okrajích.',
  'Střídej levý a pravý korálek pod úhlem 45° a na vnějším konci každého přidej oblouček rokajlů.',
  'Postup je zatím jen orientační.',
];

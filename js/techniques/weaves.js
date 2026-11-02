// More ways to join beads. Each builds real bead positions in millimetres: s along the
// bracelet, t across it, h above it. Layouts show the character of a stitch and are not
// a thread-exact path, so the written steps stay brief and marked as a guide.
import { SHAPES } from '../core/shapes.js';

const HALF_PI = Math.PI / 2;
const hash = (a, b) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function countsOf(instances) {
  const map = new Map();
  for (const b of instances) {
    const k = `${b.slot}|${b.shape}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, count]) => {
    const [slot, shape] = k.split('|');
    const def = SHAPES[shape];
    return { slot: Number(slot), count, shape, perGram: def.perGram, material: def.label, noCount: def.noCount };
  });
}

// Wraps a layout into the technique interface. `over` holds single recoloured beads.
function technique(layout, stepsText, settings) {
  const build = (part) => {
    const p = part.params;
    const result = layout({ lengthMm: 133, ...p });
    for (const [index, slot] of Object.entries(p.over ?? {})) {
      if (result.instances[index]) result.instances[index].slot = slot;
    }
    return result;
  };
  return {
    build,
    counts: (part) => countsOf(build(part).instances),
    steps: () => stepsText,
    settings: settings ?? null,
  };
}

const num = (key, label, min, max) => ({ key, label, type: 'number', min, max });

// Herringbone: columns of slanted pairs, which gives its woven, leaning look.
export const herringbone = technique((p) => {
  const pairs = p.pairs ?? 3;
  const pitch = 1.42;
  const rows = Math.floor(p.lengthMm / pitch);
  const colors = p.colors ?? 3;
  const instances = [];
  const mid = (pairs - 1) / 2;
  for (let j = 0; j < rows; j++) {
    const s = (j - (rows - 1) / 2) * pitch;
    for (let i = 0; i < pairs; i++) {
      const tc = (i - mid) * 3.15;
      let slot;
      if (p.mode === 'zigzag') slot = Math.floor((j + Math.abs(i - mid) * 3) / (p.band ?? 4)) % colors;
      else if (p.mode === 'blocks') slot = (Math.floor(j / (p.band ?? 7)) + i) % colors;
      else slot = i % colors;
      instances.push({ shape: 'delica11', slot, s, t: tc - 0.74, yaw: 0.42 });
      instances.push({ shape: 'delica11', slot, s, t: tc + 0.74, yaw: -0.42 });
    }
  }
  return { instances, length: rows * pitch, width: pairs * 3.15 };
}, [
  'Technika: rybí kost (herringbone), šitá po dvojicích korálků.',
  'Začni žebříčkem z korálků, pak do každého sloupce přidávej dva korálky naráz a nit veď dolů a zase nahoru.',
  'Dvojice se samy naklánějí, díky tomu je povrch jemně pružný.',
], [num('pairs', 'Počet sloupců', 2, 6)]);

// Right angle weave: open squares of round beads, with a small bead in each centre.
export const raw = technique((p) => {
  const a = 3.25;
  const rows = p.rows ?? 2;
  const units = Math.floor(p.lengthMm / a);
  const instances = [];
  const s0 = -(units * a) / 2;
  const t0 = -(rows * a) / 2;
  for (let i = 0; i < units; i++) {
    for (let j = 0; j <= rows; j++) instances.push({ shape: 'round3', slot: 0, s: s0 + (i + 0.5) * a, t: t0 + j * a });
  }
  for (let i = 0; i <= units; i++) {
    for (let j = 0; j < rows; j++) instances.push({ shape: 'round3', slot: 1, s: s0 + i * a, t: t0 + (j + 0.5) * a, yaw: HALF_PI });
  }
  for (let i = 0; i < units; i++) {
    for (let j = 0; j < rows; j++) instances.push({ shape: 'rocaille15', slot: 2, s: s0 + (i + 0.5) * a, t: t0 + (j + 0.5) * a, h: 1.15 });
  }
  return { instances, length: units * a + 3, width: rows * a + 3 };
}, [
  'Technika: pravoúhlé tkaní (right angle weave).',
  'Čtyři korálky tvoří čtverec, nit jimi projde dokola a navazuje další čtverec po straně.',
  'Do středů čtverců se nakonec přišije malý korálek.',
], [num('rows', 'Řady čtverců', 1, 5)]);

// Spiral rope: a core of big seed beads, wrapped in loops that climb around it.
export const spiral = technique((p) => {
  const pitch = 2;
  const count = Math.floor(p.lengthMm / pitch);
  const loop = p.loop ?? 6;
  const instances = [];
  for (let k = 0; k < count; k++) {
    const s = (k - (count - 1) / 2) * pitch;
    instances.push({ shape: 'rocaille8', slot: 0, s, t: 0 });
    const angle = k * 1.05;
    for (let q = 0; q < loop; q++) {
      const u = (q + 0.5) / loop;
      const r = 2.5 + Math.sin(Math.PI * u) * 0.5;
      const theta = angle + (0.5 - u) * 2.6; // against the turn of the rope, so loops lie side by side
      instances.push({
        shape: 'rocaille11', slot: q === Math.floor(loop / 2) ? 2 : 1,
        s: s + (u - 0.5) * 5.4, t: r * Math.cos(theta), h: r * Math.sin(theta), rx: HALF_PI - theta,
      });
    }
  }
  return { instances, length: count * pitch, width: 9, frameHeight: 30 };
}, [
  'Technika: spirálový provaz (spiral rope).',
  'Navlékni jádro z větších korálků a pak přidávej oblouky z menších, vždy přes několik korálků jádra.',
  'Každý oblouk přitlač k předchozímu, spirála se začne točit sama.',
], [num('loop', 'Korálků v oblouku', 4, 9)]);

// Bead crochet rope: a smooth tube with beads running around in a helix.
export const rope = technique((p) => {
  const around = p.around ?? 7;
  const pitch = 1.4;
  const rows = Math.floor(p.lengthMm / pitch);
  const R = (around * 1.75) / (2 * Math.PI);
  const colors = p.colors ?? 3;
  const band = p.band ?? 2;
  const instances = [];
  for (let j = 0; j < rows; j++) {
    for (let c = 0; c < around; c++) {
      const theta = (c / around) * Math.PI * 2 + j * 0.42;
      const s = (j + c / around - rows / 2) * pitch;
      let slot;
      if (p.mode === 'bands') slot = Math.floor(j / band) % colors;
      else if (p.mode === 'dots') slot = (c === 0 && j % band === 0) ? 1 : 0;
      else if (p.mode === 'mix') slot = Math.floor(hash(j, c) * colors);
      else slot = Math.floor((c * colors) / around) % colors;
      instances.push({ shape: 'rocaille11', slot, s, t: R * Math.cos(theta), h: R * Math.sin(theta), rx: HALF_PI - theta });
    }
  }
  return { instances, length: rows * pitch, width: 2 * R + 2.2, frameHeight: 28 };
}, [
  'Technika: háčkovaný provaz z korálků.',
  'Korálky se nejdřív navléknou v přesném pořadí na háčkovací nit, pak se háčkují dokola v kruhu.',
  'Vznikne hladká ohebná trubička. Spoj se schová do koncovek.',
], [num('around', 'Korálků dokola', 5, 10)]);

// Daisy chain: little flowers of six petals, linked by a few beads.
export const daisy = technique((p) => {
  const links = p.links ?? 3;
  const rho = 2.4;
  const flower = rho * 2 + 3;
  const rows = p.rows ?? 1;
  const unit = flower + links * 1.45;
  const count = Math.max(2, Math.floor(p.lengthMm / unit));
  const instances = [];
  const rowGap = rho * 2 + 3.4;
  for (let row = 0; row < rows; row++) {
    const t0 = (row - (rows - 1) / 2) * rowGap;
    for (let i = 0; i < count; i++) {
      const s0 = (i - (count - 1) / 2) * unit + (row % 2 ? unit / 2 : 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        instances.push({ shape: 'rocaille8', slot: 0, s: s0 + rho * Math.cos(a), t: t0 + rho * Math.sin(a), yaw: -a - HALF_PI });
      }
      instances.push({ shape: 'round3', slot: 1, s: s0, t: t0, h: 0.35 });
      if (i < count - 1) {
        for (let q = 0; q < links; q++) {
          instances.push({ shape: 'rocaille11', slot: 2, s: s0 + rho + 1.5 + 0.72 + q * 1.45, t: t0 });
        }
      }
    }
  }
  return { instances, length: count * unit, width: rows * rowGap, frameHeight: 26 };
}, [
  'Technika: kytičkový řetěz (daisy chain).',
  'Navlékni šest korálků do kroužku, doprostřed přidej jeden a provleč protějším korálkem.',
  'Mezi kytičky navlékni pár menších korálků a pokračuj další kytičkou.',
], [num('links', 'Korálků mezi kytičkami', 1, 8), num('rows', 'Řady kytiček', 1, 2)]);

// Netting: a lace of diamonds, with a bigger bead on every crossing.
export const net = technique((p) => {
  const rows = p.rows ?? 3;
  const a = 6.4;
  const b = 3.9;
  const per = p.edge ?? 3;
  const units = Math.floor(p.lengthMm / a);
  const instances = [];
  const s0 = -(units * a) / 2;
  const t0 = -(rows * b) / 2;
  const node = (i, j) => ({ s: s0 + i * a + (j % 2 ? a / 2 : 0), t: t0 + j * b });
  const edge = (from, to, slot) => {
    const dir = Math.atan2(to.t - from.t, to.s - from.s);
    for (let q = 1; q <= per; q++) {
      const u = q / (per + 1);
      instances.push({ shape: 'rocaille15', slot, s: from.s + (to.s - from.s) * u, t: from.t + (to.t - from.t) * u, yaw: -dir });
    }
  };
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= units; i++) {
      const n0 = node(i, j);
      if (i < units || j % 2 === 0) instances.push({ shape: 'rocaille8', slot: 1, s: n0.s, t: n0.t, h: 0.15 });
      if (j < rows) {
        const slot = j % 2 && p.twoTone ? 2 : 0;
        if (j % 2 === 0) {
          edge(n0, node(i, j + 1), slot);
          if (i > 0) edge(n0, node(i - 1, j + 1), slot);
        } else {
          if (i < units) edge(n0, node(i, j + 1), slot);
          if (i < units) edge(n0, node(i + 1, j + 1), slot);
        }
      }
      if ((j === 0 || j === rows) && i < units) edge(n0, node(i + 1, j), 0);
    }
  }
  return { instances, length: units * a + 3, width: rows * b + 3, frameHeight: 30 };
}, [
  'Technika: síťka (netting).',
  'První řada jsou oblouky z malých korálků s větším korálkem uprostřed.',
  'Každá další řada se přichytí za ty větší korálky, takže vznikají kosočtverce.',
], [num('rows', 'Řady síťky', 2, 6), num('edge', 'Korálků na straně', 2, 5)]);

// St. Petersburg chain: a double spine with little side beads, like a leafy twig.
export const petersburg = technique((p) => {
  const pitch = 4.3;
  const count = Math.floor(p.lengthMm / pitch);
  const instances = [];
  for (let k = 0; k < count; k++) {
    const s = (k - (count - 1) / 2) * pitch;
    for (const side of [-1, 1]) {
      const off = side < 0 ? 0 : pitch / 2;
      instances.push({ shape: 'rocaille11', slot: 0, s: s + off - 0.75, t: side * 1.25 });
      instances.push({ shape: 'rocaille11', slot: 0, s: s + off + 0.75, t: side * 1.25 });
      instances.push({ shape: 'rocaille11', slot: 1, s: s + off - 0.2, t: side * 3.1, yaw: side * 0.9 });
      instances.push({ shape: 'rocaille11', slot: 1, s: s + off + 1.1, t: side * 3.45, yaw: side * 0.2 });
      instances.push({ shape: 'rocaille8', slot: 2, s: s + off + 2.35, t: side * 3.65, h: 0.2 });
    }
  }
  return { instances, length: count * pitch, width: 10, frameHeight: 28 };
}, [
  'Technika: petrohradský řetěz (St. Petersburg chain).',
  'Dvojice korálků se přichytávají k sobě a na vnější straně se přidá jeden korálek jako lístek.',
  'Střídej levou a pravou stranu, vznikne řetěz podobný větvičce.',
]);

// Macrame with big round beads. Knots slide on a cord, so it closes without a clasp.
export const macrame = technique((p) => {
  const balls = p.balls ?? 5;
  const knots = p.knots ?? 3;
  const knotPitch = 1.28;
  const ball = p.big ? 'round8' : 'round6';
  const D = SHAPES[ball].size[0];
  const instances = [];
  const half = p.lengthMm / 2;
  let s = -((balls * D + (balls - 1) * knots * knotPitch) / 2);
  const firstBall = s;
  const knotAt = (x, i) => {
    instances.push({ shape: 'cordloop', slot: 1, s: x, t: 0, h: 0.5, yaw: i % 2 ? 0.2 : -0.2 });
    instances.push({ shape: 'cordloop', slot: 1, s: x, t: 0, h: -0.5, yaw: i % 2 ? -0.2 : 0.2 });
  };
  for (let i = 0; i < balls; i++) {
    instances.push({ shape: ball, slot: 0, s: s + D / 2, t: 0 });
    s += D;
    if (i < balls - 1) {
      for (let q = 0; q < knots; q++) knotAt(s + (q + 0.5) * knotPitch, q);
      s += knots * knotPitch;
    }
  }
  // Long knotted arms out to the sliding closure.
  let index = 0;
  for (let x = s + knotPitch / 2; x < half; x += knotPitch) knotAt(x, index++);
  for (let x = firstBall - knotPitch / 2; x > -half; x -= knotPitch) knotAt(x, index++);
  // Bare cord tails with a small bead on each end.
  for (const side of [-1, 1]) {
    for (let q = 0; q < 16; q++) {
      const x = side * (half + 0.6 + q * 1.15);
      const off = q * 0.32;
      instances.push({ shape: 'cordseg', slot: 1, s: x, t: 1.1 + off });
      instances.push({ shape: 'cordseg', slot: 1, s: x, t: -1.1 - off });
    }
    instances.push({ shape: 'rocaille8', slot: 2, s: side * (half + 19.6), t: 1.1 + 16 * 0.32 });
    instances.push({ shape: 'rocaille8', slot: 2, s: side * (half + 19.6), t: -1.1 - 16 * 0.32 });
  }
  return { instances, length: p.lengthMm + 40, width: 10, frameHeight: 34, noClasp: true };
}, [
  'Technika: makramé, plochý uzel kolem nosné šňůry.',
  'Navlékni kuličky na nosnou šňůru a mezi nimi vázej pracovní šňůrou ploché uzly.',
  'Konce zavaž posuvným uzlem. Spona není potřeba, náramek se stáhne na míru.',
], [num('balls', 'Počet kuliček', 1, 9), num('knots', 'Uzlíků mezi kuličkami', 1, 8)]);

// Shaggy rope of drop beads that stick out in all directions.
export const fringe = technique((p) => {
  const step = p.step ?? 0.62;
  const count = Math.floor(p.lengthMm / step);
  const colors = p.colors ?? 3;
  const instances = [];
  for (let q = 0; q <= Math.floor(p.lengthMm / 1.2); q++) {
    instances.push({ shape: 'cordseg', slot: colors, s: (q - p.lengthMm / 2.4), t: 0 });
  }
  for (let k = 0; k < count; k++) {
    const theta = k * 2.39996;
    const r = 0.9;
    const pick = p.mode === 'bands' ? Math.floor(k / (p.band ?? 36)) % colors : Math.floor(hash(k, 7) * colors);
    instances.push({
      shape: 'drop', slot: pick,
      s: (k - (count - 1) / 2) * step, t: r * Math.cos(theta), h: r * Math.sin(theta), rx: HALF_PI - theta, rz: (hash(k, 3) - 0.5) * 0.5,
    });
  }
  return { instances, length: p.lengthMm, width: 10, frameHeight: 30 };
}, [
  'Technika: střapatý provaz z kapek.',
  'Na dvě nosné nitě nebo háčkováním přidávej kapky hustě za sebou, ať odstávají na všechny strany.',
  'Čím hustší řada, tím plnější provaz.',
]);

// Flat mosaic of square two-hole Tila beads with tiny beads along the edges.
export const tilagrid = technique((p) => {
  const pitch = 5.25;
  const rows = p.rows ?? 2;
  const count = Math.floor(p.lengthMm / pitch);
  const instances = [];
  const mid = (rows - 1) / 2;
  for (let i = 0; i < count; i++) {
    for (let r = 0; r < rows; r++) {
      const slot = p.mode === 'stripes' ? r % 2 : (i + r) % 2;
      instances.push({ shape: 'tila', slot, s: (i - (count - 1) / 2) * pitch + (r % 2 ? pitch / 2 : 0), t: (r - mid) * pitch });
    }
  }
  const edge = (rows * pitch) / 2 + 0.65;
  for (const side of [-1, 1]) {
    const n = Math.floor(p.lengthMm / 1.32);
    for (let q = 0; q < n; q++) instances.push({ shape: 'rocaille15', slot: 2, s: (q - (n - 1) / 2) * 1.32, t: side * edge, h: -0.15 });
  }
  return { instances, length: count * pitch + pitch / 2, width: rows * pitch + 3, frameHeight: 30 };
}, [
  'Technika: mozaika ze čtvercových dvoudírkových korálků Tila.',
  'Oběma dírkami vedou dvě nitě, takže korálky leží rovně vedle sebe.',
  'Na okraje se přidají malé rokajly, které mozaiku zpevní a orámují.',
], [num('rows', 'Řady destiček', 1, 3)]);

// Ladder of long tube beads lying side by side across the band.
export const ladder = technique((p) => {
  const pitch = 2;
  const shape = p.short ? 'bugle3' : 'bugle6';
  const half = SHAPES[shape].size[1] / 2;
  const count = Math.floor(p.lengthMm / pitch);
  const colors = p.colors ?? 3;
  const seq = p.seq ?? [0, 0, 0, 1, 1, 2];
  const instances = [];
  for (let i = 0; i < count; i++) {
    const s = (i - (count - 1) / 2) * pitch;
    instances.push({ shape, slot: seq[i % seq.length] % colors, s, t: 0, yaw: HALF_PI });
    for (const side of [-1, 1]) instances.push({ shape: 'rocaille11', slot: colors, s, t: side * (half + 0.72) });
  }
  return { instances, length: count * pitch, width: half * 2 + 3, frameHeight: 26 };
}, [
  'Technika: žebříček z tyčinek (ladder stitch).',
  'Tyčinky se přišívají jedna vedle druhé, každou projdeš dvakrát, aby seděla rovně.',
  'Podél obou okrajů přidej rokajly, které řadu zpevní.',
]);

// Zigzag of long tube beads with round tips, single or doubled into diamonds.
export const buglezig = technique((p) => {
  const dx = 4.7;
  const amp = 2.15;
  const count = Math.floor(p.lengthMm / dx);
  const lines = p.double ? [1, -1] : [1];
  const instances = [];
  const angle = Math.atan2(2 * amp, dx);
  for (const line of lines) {
    for (let i = 0; i < count; i++) {
      const s = (i - (count - 1) / 2) * dx;
      const up = i % 2 === 0 ? 1 : -1;
      instances.push({ shape: 'bugle6', slot: 0, s, t: line * up * 0 + (p.double ? line * amp : 0), yaw: -line * up * angle });
      const tipS = s + dx / 2;
      const tipT = line * up * amp + (p.double ? line * amp : 0);
      instances.push({ shape: 'rocaille8', slot: 1, s: tipS, t: tipT, h: 0.25 });
    }
  }
  return { instances, length: count * dx + 3, width: p.double ? 14 : 8, frameHeight: 28 };
}, [
  'Technika: cik-cak z tyčinek.',
  'Střídej tyčinku a kulatý korálek, nit veď tak, aby se řada lomila do špiček.',
  'Dvojitá řada se v místech špiček spojí a vzniknou kosočtverce.',
]);

// Letter cubes that spell a word, with seed beads on both sides.
export const letters = technique((p) => {
  const text = [...String(p.text ?? 'LÁSKA').toUpperCase()].slice(0, 16);
  const cube = 6.15;
  const instances = [];
  const decals = [];
  const width = text.length * cube;
  text.forEach((char, i) => {
    const s = (i - (text.length - 1) / 2) * cube;
    if (char === ' ') {
      instances.push({ shape: 'round4', slot: 3, s, t: 0 });
      return;
    }
    instances.push({ shape: 'letter6', slot: 0, s, t: 0 });
    decals.push({ s, t: 0, h: 3.03, char, slot: 1, size: 5.2 });
  });
  const seq = [2, 2, 2, 2, 2, 3];
  for (const side of [-1, 1]) {
    let x = width / 2 + 0.5;
    for (let q = 0; x < p.lengthMm / 2; q++) {
      const slot = seq[q % seq.length];
      const shape = slot === 3 ? 'round3' : 'rocaille11';
      const adv = slot === 3 ? 3 : 1.42;
      instances.push({ shape, slot, s: side * (x + adv / 2), t: 0 });
      x += adv;
    }
  }
  return { instances, decals, length: p.lengthMm, width: 7, frameHeight: 26 };
}, [
  'Technika: navlékání s kostkami s písmeny.',
  'Navlékni slovo doprostřed a po stranách doplň malé korálky do potřebné délky.',
  'Tip: mezera mezi slovy se ukáže jako kulička, takže jde napsat třeba víc jmen.',
], [{ key: 'text', label: 'Text na kostkách', type: 'text', max: 16 }]);

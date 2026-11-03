// Little pictures for loom work, where beads sit in a straight grid. Each character is
// one bead. A dot is background, and every other character is a part named in its legend.
// The first part of the legend is the picture itself.
import { isDrawn, decodeDrawn } from './drawn.js';

export const PIXELS = {
  heart: {
    label: 'Srdíčko', legend: { '#': 'Srdíčka' },
    art: [
      '.##...##.',
      '####.####',
      '#########',
      '#########',
      '.#######.',
      '..#####..',
      '...###...',
      '....#....',
    ],
  },
  strawberry: {
    label: 'Jahoda', legend: { r: 'Jahody', g: 'Lístky', y: 'Semínka' },
    art: [
      '..g.g.g..',
      '.ggggggg.',
      'rrrrrrrrr',
      'rryrrryrr',
      'rrrrrrrrr',
      '.ryrrryr.',
      '.rrrrrrr.',
      '..rryrr..',
      '...rrr...',
      '....r....',
    ],
  },
  cat: {
    label: 'Kočička', legend: { '#': 'Kočičky', e: 'Oči', n: 'Čumáčky' },
    art: [
      '#.......#',
      '##.....##',
      '#########',
      '#########',
      '##e###e##',
      '#########',
      '####n####',
      '.#######.',
      '..#####..',
    ],
  },
  mushroom: {
    label: 'Muchomůrka', legend: { r: 'Klobouky', w: 'Tečky a nožky' },
    art: [
      '...rrr...',
      '..rrwrr..',
      '.rwrrrwr.',
      'rrrrwrrrr',
      'rwrrrrrwr',
      'rrrrrrrrr',
      '...www...',
      '...www...',
      '..wwwww..',
    ],
  },
  butterfly: {
    label: 'Motýl', legend: { a: 'Horní křídla', b: 'Spodní křídla', k: 'Tělíčka' },
    art: [
      'aa..k..aa',
      'aaa.k.aaa',
      'aaaakaaaa',
      'aaaakaaaa',
      '.aaakaaa.',
      '.bbbkbbb.',
      'bbbbkbbbb',
      'bbb.k.bbb',
      '.b..k..b.',
    ],
  },
  tulip: {
    label: 'Tulipán', legend: { f: 'Květy', g: 'Stonky' },
    art: [
      'f...f...f',
      'ff.fff.ff',
      'fffffffff',
      'fffffffff',
      '.fffffff.',
      '..fffff..',
      '....g....',
      'gg..g..gg',
      '.gg.g.gg.',
      '..ggggg..',
    ],
  },
  fish: {
    label: 'Rybička', legend: { f: 'Rybky', e: 'Oči', t: 'Ploutve' },
    art: [
      '...ffff...t',
      '..ffffff.tt',
      '.fefffffftt',
      'fffffffffff',
      '.ffffffffttt'.slice(0, 11),
      '..ffffff.tt',
      '...ffff...t',
    ],
  },
  star: {
    label: 'Hvězdička', legend: { '#': 'Hvězdy' },
    art: [
      '....#....',
      '....#....',
      '...###...',
      '#########',
      '.#######.',
      '..#####..',
      '..#####..',
      '.###.###.',
      '.#.....#.',
    ],
  },
  sun: {
    label: 'Sluníčko', legend: { s: 'Sluníčka', p: 'Paprsky' },
    art: [
      '....p....',
      '.p..p..p.',
      '..sssss..',
      '..sssss..',
      'ppsssssppp'.slice(0, 9),
      '..sssss..',
      '..sssss..',
      '.p..p..p.',
      '....p....',
    ],
  },
  smile: {
    label: 'Smajlík', legend: { y: 'Obličeje', k: 'Úsměvy' },
    art: [
      '..yyyyy..',
      '.yyyyyyy.',
      'yyykykyyy',
      'yyykykyyy',
      'yyyyyyyyy',
      'ykyyyyyky',
      'yykyyykyy',
      '.yykkkyy.',
      '..yyyyy..',
    ],
  },
  flower: {
    label: 'Květina', legend: { '#': 'Květiny', o: 'Středy' },
    art: [
      '..##.##..',
      '.#######.',
      '.#######.',
      '###ooo###',
      '.##ooo##.',
      '###ooo###',
      '.#######.',
      '.#######.',
      '..##.##..',
    ],
  },
  moon: {
    label: 'Měsíc', legend: { '#': 'Měsíce' },
    art: [
      '...####',
      '..###..',
      '.###...',
      '###....',
      '###....',
      '###....',
      '.###...',
      '..###..',
      '...####',
    ],
  },
  diamond: {
    label: 'Kosočtverec', legend: { '#': 'Kosočtverce' },
    art: [
      '....#....',
      '...###...',
      '..#####..',
      '.#######.',
      '#########',
      '.#######.',
      '..#####..',
      '...###...',
      '....#....',
    ],
  },
  cross: {
    label: 'Velký křížek', legend: { '#': 'Křížky' },
    art: ['..#..', '..#..', '#####', '..#..', '..#..'],
  },
  dot: {
    label: 'Malý křížek', legend: { '#': 'Křížky' },
    art: ['.#.', '###', '.#.'],
  },
};

const DRAWN_LEGEND = { '#': 'Motivy', o: 'Středy' };

export const pixelOf = (id) => PIXELS[id] ?? (isDrawn(id) ? { label: 'Motiv', legend: DRAWN_LEGEND, art: decodeDrawn(id, true) } : null);

// Beads of a picture placed with its left edge on column c and its top on row top.
export function placePixels(id, c, top, w, n) {
  const out = [];
  pixelOf(id).art.forEach((line, row) => {
    for (let x = 0; x < line.length; x++) {
      if (line[x] === '.') continue;
      const r = top + row;
      const col = c + x;
      if (r >= 0 && r < w && col >= 0 && col < n) out.push({ r, c: col, part: line[x] });
    }
  });
  return out;
}

export function pixelSize(id) {
  const { art } = pixelOf(id);
  return { rows: art.length, cols: Math.max(...art.map((l) => l.length)) };
}

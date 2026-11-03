// Colour catalogue. Codes are real Miyuki Delica 11/0 numbers, plus stones and metals.
import { DELICA } from '../data/delica.js';

export function finishFromName(name, glass) {
  const n = name.toLowerCase();
  const matte = n.includes('matte');
  if (n.includes('plated') || n.includes('metallic') || n.includes('galvanized')) return matte ? 'metalMatte' : 'metal';
  if (n.includes('silver-lined') || n.includes('gold-lined') || n.includes('copper-lined')) return 'lined';
  if (matte) return 'matte';
  if (glass === 's') return 'silk';
  if (glass === 'a') return 'alabaster';
  if (n.includes('color-lined')) return 'colorLined';
  if (/\bab\b/.test(n)) return 'ab';
  if (n.includes('luster')) return 'luster';
  if (glass === 't') return 'trans';
  return 'opaque';
}

const FINISH_CZ = {
  opaque: 'neprůhledná, lesklá', matte: 'matná', luster: 'perleťový lesk', ab: 'duhový lesk (AB)',
  metal: 'kovová', metalMatte: 'kovová matná', lined: 'se stříbrným jádrem', colorLined: 'barevné jádro',
  trans: 'průhledná', silk: 'hedvábný lesk', alabaster: 'alabastr', stone: 'přírodní kámen',
};
export const finishLabel = (f) => FINISH_CZ[f] ?? '';

function rgbToHsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 0.0001) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export const FAMILIES = [
  ['white', 'Bílé a krémové'], ['yellow', 'Žluté'], ['orange', 'Oranžové'], ['red', 'Červené'], ['pink', 'Růžové'],
  ['purple', 'Fialové'], ['blue', 'Modré'], ['teal', 'Tyrkysové'], ['green', 'Zelené'], ['brown', 'Hnědé'],
  ['gray', 'Šedé a černé'], ['metal', 'Kovové'],
];

export function familyOf(hex, finish) {
  if (finish === 'metal' || finish === 'metalMatte') return 'metal';
  const { h, s, l } = rgbToHsl(hex);
  if (l > 0.78 && s < 0.45) return 'white';
  if (s < 0.12 || l < 0.12) return 'gray';
  if (l < 0.42 && h > 15 && h < 60) return 'brown';
  if (h < 12 || h >= 348) return l > 0.6 ? 'pink' : 'red';
  if (h < 36) return s < 0.4 ? 'brown' : 'orange';
  if (h < 68) return s < 0.34 ? 'brown' : 'yellow';
  if (h < 165) return 'green';
  if (h < 198) return 'teal';
  if (h < 252) return 'blue';
  if (h < 300) return 'purple';
  return 'pink';
}

// Stones and metals used in strung pieces. These have no Delica number.
const EXTRA = [
  ['ST-MOON', 'CFD6E6', 'Měsíční kámen', 'alabaster'],
  ['ST-AMAZ', '8CC7B4', 'Amazonit', 'alabaster'],
  ['ST-WHITE', 'EEECE7', 'Bílý kámen', 'alabaster'],
  ['ST-HEMA', '3C3D42', 'Hematit', 'metal'],
  ['ST-PEARL', 'F1E8D8', 'Perla', 'luster'],
  ['MT-STEEL', '9FA1A6', 'Chirurgická ocel', 'metal'],
  ['MT-ROSE', 'C98E78', 'Růžové zlato', 'metal'],
];

const byCode = new Map();
for (const [code, hex, name, glass, disc] of DELICA) {
  const finish = finishFromName(name, glass);
  byCode.set(code, { code, hex, name, finish, discontinued: !!disc, family: familyOf(hex, finish) });
}
for (const [code, hex, name, finish] of EXTRA) {
  byCode.set(code, { code, hex, name, finish, family: finish === 'metal' ? 'metal' : familyOf(hex, finish), extra: true });
}

// The everyday palette, each colour a real bead. Czech names are ours: Miyuki publishes none.
export const PALETTE = [
  ['white', 'DB0200', 'Bílá'], ['pearl', 'DB0201', 'Perleťová bílá'], ['cream', 'DB1530', 'Krémová'], ['beige', 'DB0204', 'Béžová'],
  ['paleyellow', 'DB1855', 'Medově žlutá'], ['yellow', 'DB0721', 'Žlutá'], ['amber', 'DB1132', 'Slunečnicová'], ['orange', 'DB1133', 'Oranžová'],
  ['coral', 'DB2113', 'Korálová'], ['red', 'DB0727', 'Červená'], ['blush', 'DB0246', 'Pudrová růžová'], ['rose', 'DB2116', 'Lososově růžová'],
  ['pink', 'DB2036', 'Růžová'], ['hot', 'DB2035', 'Zářivě růžová'], ['raspberry', 'DB2050', 'Malinová'], ['oldrose', 'DB0625', 'Starorůžová'],
  ['berry', 'DB1564', 'Ostružinová'], ['orchid', 'DB0247', 'Orchidejová'], ['lavender', 'DB2136', 'Levandulová'], ['lilac', 'DB0248', 'Lila'],
  ['purple', 'DB1379', 'Fialová'], ['violet', 'DB0783', 'Matná fialová'], ['deep', 'DB1896', 'Půlnoční fialová'], ['heaven', 'DB0861', 'Nebeská modrá'], ['paleblue', 'DB1859', 'Ledově modrá'],
  ['sky', 'DB2039', 'Nebeská'], ['azure', 'DB0725', 'Blankytná'], ['denim', 'DB2134', 'Džínová modrá'], ['royal', 'DB1110', 'Královská modrá'], ['periwinkle', 'DB1588', 'Chrpová'], ['cobalt', 'DB0726', 'Kobaltová'],
  ['navy', 'DB2144', 'Námořnická'], ['turq', 'DB2130', 'Tyrkysová'], ['lightturq', 'DB0239', 'Světle tyrkysová'], ['aqua', 'DB2122', 'Mořská'], ['mint', 'DB1707', 'Mátová'],
  ['teal', 'DB2133', 'Petrolejová'], ['petrol', 'DB2385', 'Tmavě petrolejová'], ['pistachio', 'DB1858', 'Pistáciová'], ['lime', 'DB2031', 'Limetková'],
  ['green', 'DB2121', 'Trávová'], ['emerald', 'DB2126', 'Smaragdová'], ['forest', 'DB2127', 'Lesní'], ['olive', 'DB0733', 'Olivová'],
  ['brown', 'DB2142', 'Hnědá'], ['gray', 'DB1498', 'Šedá'], ['black', 'DB0010', 'Černá'], ['matteblack', 'DB0310', 'Matná černá'],
  ['gold', 'DB0031', 'Zlatá 24k'], ['galvgold', 'DB1832', 'Zlatavá'], ['silver', 'DB0035', 'Stříbrná'], ['palladium', 'DB0038', 'Paladium'],
].map(([key, code, name]) => ({ key, code, name, ...pick(code) }));

function pick(code) {
  const b = byCode.get(code);
  if (!b) throw new Error(`Kód ${code} není v katalogu`);
  return { hex: b.hex, finish: b.finish, family: b.family };
}

const czByCode = new Map(PALETTE.map((p) => [p.code, p.name]));
const byKey = new Map(PALETTE.map((p) => [p.key, p.code]));

// Named colours used by the extra palette and pattern presets.
const KEY_ALIAS = {
  moon: 'ST-MOON', amazonite: 'ST-AMAZ', whitestone: 'ST-WHITE', hematite: 'ST-HEMA', stonepearl: 'ST-PEARL',
  steel: 'MT-STEEL', rosemetal: 'MT-ROSE', irisblue: 'DB0005', irisgreen: 'DB0003', irispurple: 'DB1001',
  silverlined: 'DB0041', goldlined: 'DB0042', bronze: 'DB0022', copper: 'DB0037', cobaltab: 'DB0165',
  powderblue: 'DB0257', burgundy: 'DB0654', taupe: 'DB0355', graylilac: 'DB0357', dustyblue: 'DB2132',
  mustard: 'DB2102', sage: 'DB1496', matteblue: 'DB0755', mattenavy: 'DB0756',
};

export const codeOf = (key) => byKey.get(key) ?? KEY_ALIAS[key] ?? key;

export function bead(code) {
  const b = byCode.get(code);
  if (!b) throw new Error(`Neznámý kód korálku: ${code}`);
  return b;
}

export const hasBead = (code) => byCode.has(code);

export function czName(code) {
  const cz = czByCode.get(code);
  if (cz) return cz;
  const b = byCode.get(code);
  if (!b) return code;
  if (b.extra) return b.name;
  const fam = FAMILIES.find(([id]) => id === b.family)?.[1] ?? '';
  return `${fam.replace(/é a .*$/, 'á').replace(/é$/, 'á')}, ${finishLabel(b.finish)}`;
}

export const allBeads = () => [...byCode.values()].filter((b) => !b.discontinued);
export const extraBeads = () => [...byCode.values()].filter((b) => b.extra);

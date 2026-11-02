// Ready-made patterns. A pattern is a shape. Colourways only change colours, so the
// same shape in other colours stays one pattern. Every colour is a real catalogue bead.
import { makeDesign, bandLengthMm, colsForWrist, applyColorway, WRIST_DEFAULT } from './design.js';
import { generate, DEFAULT_SIZE } from '../techniques/peyote.js';

// 11 rows of Delica 15/0: the heart fills the band as in the images, about 1.3 cm wide,
// with the same one free row above and below it.
const WIDTH = 11;
const FULL_COLS = colsForWrist(WRIST_DEFAULT, 1.3);
const BAND_MM = bandLengthMm(WRIST_DEFAULT);
const HEARTS = ['heartN', 'heartN', 'heartN', 'heartN'];

// The tabs of the gallery, one per way of making a bracelet. A pattern belongs to the tab
// that lists its group.
export const COLLECTIONS = [
  { id: 'pasy', label: 'Šité pásy', hint: 'Peyote z korálků Delica: pevný pásek, na kterém dobře vyjde každý motiv. Barevné kombinace si přepneš přímo v návrhu.', groups: ['Čtyři srdíčka', 'Další srdíčka', 'Hvězdy a květiny', 'Geometrie', 'Přechody'] },
  { id: 'tkane', label: 'Tkané', hint: 'Tkané na stávku. Korálky leží v rovných řadách, takže na nich vyjdou i malé obrázky.', groups: ['Tkané obrázky', 'Tkané vzory'] },
  { id: 'stehy', label: 'Šité stehy', hint: 'Každý steh má vlastní vazbu a jiný vzhled. Postup je u nich jen orientační.', groups: ['Rybí kost', 'Další stehy'] },
  { id: 'krajka', label: 'Kytičky a krajka', hint: 'Vzdušné řetízky šité z rokajlů. Postup je u nich jen orientační.', groups: ['Kytičky', 'Krajka'] },
  { id: 'provazy', label: 'Provazy a uzlíky', hint: 'Kulaté provazy, makramé a střapaté třásně. Postup je u nich jen orientační.', groups: ['Provazy', 'Makramé', 'Třásně'] },
  { id: 'tvary', label: 'Destičky a tyčinky', hint: 'Jiné tvary korálků: dvoudírkové destičky Tila a dlouhé tyčinky. Postup je u nich jen orientační.', groups: ['Destičky Tila', 'Sady se zig-zagem', 'Tyčinky'] },
  { id: 'navlekane', label: 'Navlékané', hint: 'Korálky navlečené na niti nebo gumičce, v jednom i v několika pramenech. Postup je u nich jen orientační.', groups: ['Navlékané', 'Navlékané prameny'] },
];

const list = [];

function addPeyote({ id, group, name, params, colorways }) {
  const full = { w: WIDTH, n: FULL_COLS, size: DEFAULT_SIZE, ...params };
  list.push({
    id, group, name, colorways,
    make() {
      const slots = generate(full).roles.map((role) => ({ ...role, code: 'white' }));
      const d = makeDesign({ name, slots, preset: id, parts: [{ tech: 'peyote', params: JSON.parse(JSON.stringify(full)), cells: null }] });
      applyColorway(d, colorways[0]);
      return d;
    },
  });
}

// --- Four hearts: one shape each, with the combinations from the reference images ---

const heartColors = (bg, hearts, extra = {}) => ({ Podklad: bg, Srdíčka: hearts.split(' '), ...extra });

const GROUND = {
  'Modrý podklad': ['heaven', [
    ['Nebeská harmonie', 'royal aqua pink lilac'], ['Modrá svěžest', 'white royal green yellow'],
    ['Letní nebe', 'yellow sky purple pink'], ['Ledová duha', 'cobalt white pink purple'],
    ['Tyrkysový vítr', 'aqua green yellow pink'], ['Arktická', 'navy sky lilac white'],
    ['Jarní obloha', 'green yellow pink purple'], ['Jemná modrá', 'white aqua royal pink'],
  ]],
  'Krémový podklad': ['cream', [
    ['Krémová klasika', 'royal yellow green pink'], ['Pastelová radost', 'aqua purple pink yellow'],
    ['Přírodní jemnost', 'green yellow pink purple'], ['Elegantní krém', 'royal white lilac pink'],
    ['Krémová duha', 'aqua teal pink purple'], ['Sluneční sen', 'yellow royal lilac pink'],
    ['Bohémská', 'teal yellow pink green'], ['Krémová svěžest', 'royal sky white pink'],
  ]],
  'Žlutý podklad': ['paleyellow', [
    ['Sluneční energie', 'royal green pink purple'], ['Jarní slunce', 'aqua royal lilac white'],
    ['Veselá žlutá', 'royal white pink green'], ['Letní záře', 'aqua purple pink royal'],
    ['Citrusová', 'emerald royal yellow pink'], ['Medová', 'purple royal white pink'],
    ['Teplá duha', 'aqua teal purple pink'], ['Sluneční louka', 'royal yellow pink purple'],
  ]],
  'Zelený podklad': ['pistachio', [
    ['Jarní zeleň', 'royal yellow pink purple'], ['Svěží louka', 'white aqua royal pink'],
    ['Přírodní harmonie', 'yellow royal lilac pink'], ['Lesní vánek', 'aqua white pink purple'],
    ['Jarní probuzení', 'royal green yellow pink'], ['Zelená elegance', 'purple pink white royal'],
    ['Zahradní', 'yellow aqua pink purple'], ['Jemná pistácie', 'white green royal pink'],
  ]],
  'Fialový podklad': ['lavender', [
    ['Levandulové ráno', 'royal pink yellow aqua'], ['Fialová pohoda', 'white royal pink yellow'],
    ['Květnová', 'aqua lilac pink green'], ['Fialová duha', 'yellow royal white pink'],
    ['Romantická fialová', 'cobalt aqua purple pink'], ['Jarní fialka', 'green yellow pink white'],
    ['Jemná levandule', 'white lilac royal pink'], ['Večerní fialová', 'yellow purple aqua pink'],
  ]],
  'Růžový podklad': ['blush', [
    ['Růžová radost', 'royal yellow green purple'], ['Jemná růžová', 'white aqua purple yellow'],
    ['Květinová', 'royal pink white green'], ['Sladká růže', 'yellow aqua lilac purple'],
    ['Růžová louka', 'green royal pink yellow'], ['Jarní růžová', 'aqua white pink purple'],
    ['Růžový sen', 'purple yellow royal white'], ['Veselá růžová', 'royal aqua yellow pink'],
  ]],
};

const plainWays = Object.entries(GROUND).flatMap(([set, [bg, items]]) =>
  items.map(([name, hearts]) => ({ name, set, colors: heartColors(bg, hearts) })));
for (const [name, bg, hearts] of [
  ['Galaxy', 'deep', 'sky lilac blush aqua'], ['Tropická', 'turq', 'yellow orange pink purple'],
  ['Nebeská', 'paleblue', 'white royal blush purple'], ['Mátová', 'mint', 'white turq pink lilac'],
  ['Letní nebe II', 'sky', 'yellow aqua white pink'],
]) plainWays.push({ name, set: 'Barevný mix', colors: heartColors(bg, hearts) });

addPeyote({
  id: 'srdce', group: 'Čtyři srdíčka', name: '4 srdíčka',
  params: { kind: 'motifs', seq: HEARTS, motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 2 },
  colorways: plainWays,
});

const END_WAYS = [
  ['Slunečná duha', 'white', 'amber sky green pink', 'gold'], ['Pastelová radost', 'white', 'sky lilac pink yellow', 'lilac'],
  ['Neon mix', 'black', 'yellow sky hot lime', 'hot'], ['Jarní louka', 'white', 'green amber pink purple', 'galvgold'],
  ['Mořská vlna', 'navy', 'aqua white lilac yellow', 'royal'], ['Cukrová', 'white', 'pink paleblue purple yellow', 'gold'],
  ['Lesní elegance', 'forest', 'lime aqua blush lilac', 'gold'], ['Zmrzlinová', 'white', 'aqua yellow pink lilac', 'gold'],
  ['Neon duha', 'black', 'aqua yellow hot purple', 'hot'], ['Osvěžující', 'white', 'sky green amber pink', 'gold'],
  ['Sladká duha', 'white', 'hot yellow lilac aqua', 'gold'], ['Aurora', 'petrol', 'lime aqua sky lilac', 'turq'],
  ['Sněhová duha', 'white', 'sky pink aqua amber', 'gold'], ['Berry mix', 'berry', 'yellow blush lilac aqua', 'hot'],
  ['Citron a borůvka', 'white', 'amber royal purple pink', 'gold'], ['Jarní neon', 'white', 'lime hot yellow purple', 'gold'],
  ['Duha na bílé', 'white', 'royal green yellow pink', 'gold'], ['Večerní obloha', 'navy', 'amber sky lilac pink', 'pink'],
  ['Svěží pastel', 'white', 'aqua sky purple hot', 'gold'], ['Víly', 'lilac', 'yellow white pink purple', 'gold'],
  ['Zářivá', 'raspberry', 'turq amber lime purple', 'blush'], ['Jemná elegance', 'cream', 'lilac pink aqua yellow', 'gold'],
  ['Fantazie', 'black', 'sky lime yellow pink', 'lilac'],
];
addPeyote({
  id: 'srdce-konce', group: 'Čtyři srdíčka', name: '4 srdíčka s barevnými konci',
  params: { kind: 'motifs', seq: HEARTS, motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 2, ends: 2 },
  colorways: END_WAYS.map(([name, bg, hearts, ends]) => ({
    name, set: ['black', 'navy', 'forest', 'petrol', 'berry', 'raspberry'].includes(bg) ? 'Tmavý podklad' : bg === 'white' || bg === 'cream' ? 'Světlý podklad' : 'Barevný podklad',
    colors: heartColors(bg, hearts, { Konce: ends }),
  })),
});

const CLASSIC = [
  ['Klasická', 'pearl', 'royal royal pink pink'], ['Jemná', 'pearl', 'turq turq purple purple'],
  ['Královská', 'pearl', 'cobalt cobalt raspberry raspberry'], ['Pastelová', 'pearl', 'sky sky blush blush'],
  ['Kontrastní', 'pearl', 'royal turq raspberry lilac'], ['Přírodní', 'pearl', 'teal teal oldrose oldrose'],
  ['Duha', 'pearl', 'royal sky pink purple'], ['Tmavá elegantní', 'navy', 'sky sky pink pink'],
];
addPeyote({
  id: 'srdce-mezi', group: 'Čtyři srdíčka', name: '4 srdíčka se zlatými mezičlánky',
  params: { kind: 'motifs', seq: HEARTS, motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 1, spacer: 'dot', ends: 2 },
  colorways: CLASSIC.map(([name, bg, hearts]) => ({ name, colors: heartColors(bg, hearts, { Mezičlánky: 'gold', Konce: 'gold' }) })),
});

addPeyote({
  id: 'srdce-troj', group: 'Čtyři srdíčka', name: '4 srdíčka s trojúhelníky',
  params: { kind: 'motifs', seq: HEARTS, motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 2, ends: 2, bg2: true },
  colorways: [
    { name: 'Korálová', colors: heartColors('coral', 'aqua amber white purple', { Konce: 'raspberry', Trojúhelníky: 'blush' }) },
    { name: 'Levandulová', colors: heartColors('lilac', 'yellow pink purple aqua', { Konce: 'lilac', Trojúhelníky: 'lavender' }) },
  ],
});

// --- Other techniques ---

function tilaPart(extra = {}) {
  return { tech: 'tila', params: { lengthMm: BAND_MM, ...extra }, cells: null };
}
function strandPart(strands) {
  return { tech: 'strand', params: { lengthMm: BAND_MM + 4, strands: strands.map((seq) => ({ seq })) }, cells: null };
}

const TILA_GROUPS = ['Destičky A', 'Destičky B', 'Okrajové korálky', 'Akcent'];
const zigzag = (name, a, b, edge, metal = 'steel') => ({ name, metal, colors: { [TILA_GROUPS[0]]: a, [TILA_GROUPS[1]]: b, [TILA_GROUPS[2]]: edge } });
const ZIGZAG_WAYS = [
  zigzag('Fialová a krémová', 'irispurple', 'cream', 'bronze', 'rose'), zigzag('Medová a krémová', 'goldlined', 'cream', 'amber', 'rose'),
  zigzag('Modrá a žlutá', 'mattenavy', 'yellow', 'palladium'), zigzag('Zelená a tyrkysová', 'sage', 'turq', 'emerald'),
  zigzag('Modrá a starorůžová', 'navy', 'oldrose', 'irisblue'), zigzag('Bílá a stříbrná', 'white', 'silver', 'irisblue'),
  zigzag('Kobaltová', 'cobaltab', 'cobaltab', 'royal'), zigzag('Krémová a levandulová', 'cream', 'lavender', 'cobalt'),
  zigzag('Šedomodrá', 'dustyblue', 'silkblue', 'irisblue'), zigzag('Nebeská a stříbrná', 'azure', 'silver', 'irisblue'),
  zigzag('Černá a tyrkysová', 'black', 'turq', 'black'),
];
list.push({
  id: 'zigzag', group: 'Destičky Tila', name: 'Šitý zig-zag', colorways: ZIGZAG_WAYS,
  make() {
    const d = makeDesign({
      name: 'Šitý zig-zag', preset: 'zigzag',
      slots: TILA_GROUPS.slice(0, 3).map((label) => ({ label, group: label, code: 'white' })),
      parts: [tilaPart()],
    });
    applyColorway(d, ZIGZAG_WAYS[0]);
    return d;
  },
});

addPeyote({
  id: 'melir', group: 'Přechody', name: 'Melírovaný pás',
  params: { kind: 'speckle', w: 10, size: 11, n: colsForWrist(WRIST_DEFAULT, 1.6), weights: [0.42, 0.26, 0.2, 0.12], taper: true },
  colorways: [
    { name: 'Modrý', colors: { 'Barva 1': 'royal', 'Barva 2': 'azure', 'Barva 3': 'silverlined', 'Barva 4': 'olive' } },
    { name: 'Noc', colors: { 'Barva 1': 'navy', 'Barva 2': 'irisblue', 'Barva 3': 'cobalt', 'Barva 4': 'gold' } },
    { name: 'Levandule', colors: { 'Barva 1': 'lavender', 'Barva 2': 'lilac', 'Barva 3': 'white', 'Barva 4': 'irispurple' } },
  ],
});

// Sets differ in rhythm, not only in colour. A sequence item is [slot, count, shape].
const SETS = [
  { name: 'Dva prameny se zlatými kuličkami', slug: 'dva-zlate', slots: ['irisblue', 'gold', 'stonepearl'], parts: () => [strandPart([
    [[0, 58], [1, 1, 'round3'], [0, 6], [2, 1, 'round3']],
    [[0, 40], [1, 1, 'round3'], [0, 44]],
  ])] },
  { name: 'Dva prameny, kobaltová a lila', slug: 'dva-kobalt', slots: ['cobalt', 'silver', 'lilac', 'black'], parts: () => [strandPart([
    [[0, 15], [1, 3], [2, 7], [1, 2]],
    [[3, 22], [0, 12], [1, 1, 'round3']],
  ])] },
  { name: 'Dva prameny, námořnická a stříbrná', slug: 'dva-namornicka', slots: ['navy', 'silverlined', 'dustyblue', 'blush'], parts: () => [strandPart([
    [[0, 14], [1, 8], [2, 5]],
    [[0, 16], [3, 7], [1, 6]],
  ])] },
  { name: 'Dva prameny, smaragdová a bílá', slug: 'dva-smaragd', slots: ['emerald', 'white', 'silver'], parts: () => [strandPart([
    [[0, 11], [2, 1], [1, 4], [2, 1]],
    [[0, 16], [1, 7], [2, 2]],
  ])] },
  { name: 'Dva prameny s bílými kamínky', slug: 'dva-kaminky', slots: ['black', 'silver', 'whitestone'], parts: () => [strandPart([
    [[0, 26], [2, 1, 'round4'], [0, 3], [2, 1, 'round4'], [0, 3], [2, 1, 'round4']],
    [[1, 34], [0, 7]],
  ])] },
  { name: 'Dva prameny, ledově modrá', slug: 'dva-ledove', slots: ['paleblue', 'black', 'cobalt', 'silverlined'], parts: () => [strandPart([
    [[0, 20], [1, 2], [3, 6], [2, 2]],
    [[3, 16], [2, 2], [0, 12], [1, 2]],
  ])] },
  { name: 'Tři prameny, stříbrná a bílá', slug: 'tri-stribrna', slots: ['silver', 'white', 'blush', 'hematite'], parts: () => [strandPart([
    [[0, 30], [1, 12]],
    [[1, 22], [2, 5], [0, 10]],
    [[0, 26], [3, 1, 'round3'], [1, 14]],
  ])] },
  { name: 'Tři prameny, ostružinová a bílá', slug: 'tri-ostruzina', slots: ['berry', 'white', 'silver'], parts: () => [strandPart([
    [[0, 7], [1, 7]],
    [[0, 12], [2, 2], [1, 5], [2, 2]],
    [[1, 10], [0, 8]],
  ])] },
  { name: 'Tři prameny, kobaltová', slug: 'tri-kobalt', slots: ['cobalt', 'azure', 'white', 'silver'], parts: () => [strandPart([
    [[0, 18], [2, 1], [0, 8], [3, 1, 'round3']],
    [[1, 12], [3, 2], [2, 5], [3, 2]],
    [[0, 24], [1, 6], [2, 2]],
  ])] },
  { name: 'Dva prameny s amazonitem', slug: 'dva-amazonit', slots: ['petrol', 'amazonite', 'hematite', 'silver'], parts: () => [strandPart([
    [[0, 34], [1, 1, 'round4'], [0, 2], [1, 1, 'round4'], [0, 2], [1, 1, 'round4'], [0, 2], [1, 1, 'round4'], [0, 2], [1, 1, 'round4']],
    [[0, 44], [2, 1, 'round3'], [0, 6], [3, 2]],
  ])] },
  { name: 'Tři prameny s destičkami', slug: 'tri-desticky', slots: ['matteblack', 'white', 'palladium', 'hematite'], parts: () => [strandPart([
    [[0, 9, 'halftila'], [1, 1, 'halftila'], [2, 1, 'halftila']],
    [[0, 22], [2, 2], [3, 1, 'round3'], [2, 2]],
    [[3, 18], [0, 10], [1, 1]],
  ])] },
  { name: 'Čtyři prameny, stříbrná a růžová', slug: 'ctyri-stribrna', slots: ['silver', 'blush', 'white', 'hematite'], parts: () => [strandPart([
    [[0, 34], [1, 3]],
    [[0, 22], [2, 6], [0, 8], [1, 2]],
    [[2, 18], [1, 4], [0, 14]],
    [[0, 40], [3, 1, 'round3']],
  ])] },
  { name: 'Zig-zag a prameny, královská modrá', slug: 'zigzag-modra', tila: true, slots: ['royal', 'white', 'blush', 'irispurple', 'sky'], parts: () => [tilaPart(), strandPart([
    [[3, 28], [4, 1, 'halftila'], [3, 12]],
    [[3, 18], [1, 1, 'round3'], [3, 22]],
  ])] },
  { name: 'Zig-zag a prameny, medová', slug: 'zigzag-medova', tila: true, slots: ['mustard', 'mustard', 'palladium', 'black', 'gold'], parts: () => [tilaPart({ accentEvery: 9 }), strandPart([
    [[3, 4, 'halftila'], [2, 1, 'halftila'], [3, 3, 'halftila'], [0, 1, 'halftila']],
    [[3, 14], [4, 3], [2, 2], [3, 6]],
  ])] },
  { name: 'Zig-zag a prameny, lila', slug: 'zigzag-lila', tila: true, slots: ['lavender', 'violet', 'irispurple', 'moon', 'hematite'], parts: () => [tilaPart(), strandPart([
    [[1, 26], [3, 1, 'round4'], [1, 5], [3, 1, 'round4'], [1, 5], [3, 1, 'round4']],
    [[2, 36], [4, 1, 'round3'], [1, 12]],
  ])] },
  { name: 'Zig-zag a prameny, ostružinová', slug: 'zigzag-ostruzina', tila: true, slots: ['berry', 'graylilac', 'raspberry', 'silverlined', 'hematite'], parts: () => [tilaPart(), strandPart([
    [[3, 24], [2, 4], [3, 8], [2, 3]],
    [[2, 18], [3, 14], [4, 1, 'round3']],
  ])] },
  { name: 'Zig-zag a prameny, šedofialová', slug: 'zigzag-sedofialova', tila: true, slots: ['taupe', 'graylilac', 'bronze', 'silver', 'irispurple'], parts: () => [tilaPart(), strandPart([
    [[4, 22], [3, 8], [0, 1, 'halftila'], [4, 8]],
    [[3, 16], [4, 18], [2, 2]],
  ])] },
  { name: 'Zig-zag a prameny, černá', slug: 'zigzag-cerna', tila: true, slots: ['matteblack', 'matteblack', 'silver', 'cobaltab', 'black'], parts: () => [tilaPart({ accentEvery: 8 }), strandPart([
    [[4, 26], [2, 3], [4, 12], [3, 1, 'halftila']],
    [[4, 34], [2, 1, 'round3'], [4, 10]],
    [[4, 18], [2, 2], [4, 18], [2, 2]],
  ])] },
];
for (const set of SETS) {
  const id = `sada-${set.slug}`;
  list.push({
    id, group: set.tila ? 'Sady se zig-zagem' : 'Navlékané prameny', name: set.name, colorways: [],
    make() {
      const slots = set.slots.map((code, i) => {
        const label = set.tila && i < 3 ? TILA_GROUPS[i] : `Barva ${i + 1}`;
        return { code, label, group: label };
      });
      return makeDesign({ name: set.name, preset: id, slots, parts: set.parts() });
    },
  });
}

// --- More motifs that belong with the family hearts ---

const motifWay = (name, bg, motifs, groupName, extra = {}) => ({ name, colors: { Podklad: bg, [groupName]: motifs.split(' '), ...extra } });
const ways = (...items) => items.map(([name, ...colors]) => ({ name, colors: Object.fromEntries(colors) }));

addPeyote({
  id: 'rodina', group: 'Další srdíčka', name: 'Velká a malá srdíčka',
  params: { kind: 'motifs', seq: ['heartS', 'heartN', 'heartN', 'heartS'], motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 2, ends: 2 },
  colorways: [motifWay('Rodinná', 'pearl', 'pink cobalt raspberry sky', 'Srdíčka', { Konce: 'gold' })],
});
addPeyote({
  id: 'dva-a-dve', group: 'Další srdíčka', name: 'Šest srdíček',
  params: { kind: 'motifs', seq: ['heartS', 'heartS', 'heartN', 'heartN', 'heartS', 'heartS'], motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 1, ends: 2 },
  colorways: [motifWay('Dva a dvě', 'cream', 'royal sky raspberry cobalt pink blush', 'Srdíčka', { Konce: 'gold' })],
});
addPeyote({
  id: 'radka', group: 'Další srdíčka', name: 'Řada malých srdíček',
  params: { kind: 'motifs', seq: Array(8).fill('heartS'), motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 2, ends: 2 },
  colorways: [motifWay('Duhová', 'white', 'royal pink sky blush turq hot purple yellow', 'Srdíčka', { Konce: 'gold' })],
});
addPeyote({
  id: 'jedno', group: 'Další srdíčka', name: 'Jedno velké srdce',
  params: { kind: 'motifs', w: 15, seq: ['heartL'], motifLabel: 'Srdce', motifGroup: 'Srdce', gap: 1 },
  colorways: [motifWay('Malinová', 'blush', 'raspberry', 'Srdce')],
});
addPeyote({
  id: 'krizky', group: 'Další srdíčka', name: 'Srdíčka a křížky',
  params: { kind: 'motifs', seq: HEARTS, motifLabel: 'Srdíčko', motifGroup: 'Srdíčka', gap: 1, spacer: 'cross' },
  colorways: [motifWay('Stříbrná', 'white', 'cobalt cobalt raspberry raspberry', 'Srdíčka', { Mezičlánky: 'palladium' })],
});
addPeyote({
  id: 'hvezdy', group: 'Hvězdy a květiny', name: 'Hvězdy',
  params: { kind: 'motifs', seq: Array(4).fill('star'), motifLabel: 'Hvězda', motifGroup: 'Hvězdy', gap: 2 },
  colorways: [
    motifWay('Hvězdná noc', 'navy', 'gold paleyellow gold paleyellow', 'Hvězdy'),
    motifWay('Pro čtyři', 'pearl', 'royal sky pink raspberry', 'Hvězdy'),
  ],
});
addPeyote({
  id: 'kvetiny', group: 'Hvězdy a květiny', name: 'Květiny',
  params: { kind: 'motifs', seq: Array(4).fill('flower'), motifLabel: 'Květina', motifGroup: 'Květiny', gap: 3 },
  colorways: [
    motifWay('Louka', 'pistachio', 'hot yellow purple orange', 'Květiny'),
    motifWay('Na krému', 'cream', 'raspberry lilac amber turq', 'Květiny'),
  ],
});
addPeyote({
  id: 'ctyrlistky', group: 'Hvězdy a květiny', name: 'Čtyřlístky',
  params: { kind: 'motifs', seq: Array(4).fill('clover'), motifLabel: 'Čtyřlístek', motifGroup: 'Čtyřlístky', gap: 3 },
  colorways: [motifWay('Pro štěstí', 'white', 'emerald green emerald green', 'Čtyřlístky')],
});
addPeyote({
  id: 'kosoctverce', group: 'Hvězdy a květiny', name: 'Kosočtverce',
  params: { kind: 'motifs', seq: Array(5).fill('diamond'), motifLabel: 'Kosočtverec', motifGroup: 'Kosočtverce', gap: 1 },
  colorways: [motifWay('Modré', 'pearl', 'royal turq purple turq royal', 'Kosočtverce')],
});
addPeyote({
  id: 'cikcak', group: 'Geometrie', name: 'Cik-cak',
  params: { kind: 'chevron', colors: 3, band: 3 },
  colorways: ways(
    ['Slunce', ['Barva 1', 'amber'], ['Barva 2', 'orange'], ['Barva 3', 'raspberry']],
    ['Moře', ['Barva 1', 'cobalt'], ['Barva 2', 'turq'], ['Barva 3', 'white']],
  ),
});
addPeyote({
  id: 'diagonaly', group: 'Geometrie', name: 'Diagonály',
  params: { kind: 'diagonal', colors: 3, band: 3 },
  colorways: ways(['Námořní', ['Barva 1', 'navy'], ['Barva 2', 'gold'], ['Barva 3', 'pearl']]),
});
addPeyote({
  id: 'argyle', group: 'Geometrie', name: 'Argyle',
  params: { kind: 'argyle' },
  colorways: ways(['Malinový', ['Podklad', 'cream'], ['Kosočtverce', 'raspberry'], ['Středy', 'gold']]),
});
addPeyote({
  id: 'kostky', group: 'Geometrie', name: 'Kostky',
  params: { kind: 'checks', block: 3, colors: 2 },
  colorways: ways(['Černobílé', ['Barva 1', 'black'], ['Barva 2', 'white']]),
});
addPeyote({
  id: 'pruhy', group: 'Geometrie', name: 'Pruhy',
  params: { kind: 'stripes', layout: [0, 0, 1, 2, 2, 1, 0, 0] },
  colorways: ways(['Námořní', ['Pruh 1', 'navy'], ['Pruh 2', 'gold'], ['Pruh 3', 'pearl']]),
});
addPeyote({
  id: 'vlnky', group: 'Geometrie', name: 'Vlnky',
  params: { kind: 'wave', double: true, period: 24 },
  colorways: ways(['Mořské', ['Podklad', 'paleblue'], ['Vlna', 'royal'], ['Druhá vlna', 'white']]),
});
const OMBRE = (name, ...codes) => ({ name, colors: Object.fromEntries(codes.map((code, i) => [`Odstín ${i + 1}`, code])) });
addPeyote({
  id: 'ombre', group: 'Přechody', name: 'Ombré',
  params: { kind: 'ombre', colors: 5 },
  colorways: [OMBRE('Růžové', 'raspberry', 'hot', 'pink', 'blush', 'white'), OMBRE('Moře', 'navy', 'cobalt', 'royal', 'sky', 'paleblue')],
});
addPeyote({
  id: 'duha', group: 'Přechody', name: 'Duha',
  params: { kind: 'ombre', colors: 7, mirror: false, dither: 0.7 },
  colorways: [OMBRE('Duha', 'purple', 'royal', 'turq', 'green', 'yellow', 'orange', 'hot')],
});

// --- Other kinds of beads and other ways of joining them ---

function addTech({ id, group, name, tech, params = {}, labels, ways: rows, metal }) {
  const colorways = rows.map(([wayName, ...codes]) => ({
    name: wayName, colors: Object.fromEntries(labels.map((label, i) => [label, codes[i]])),
  }));
  list.push({
    id, group, name, colorways,
    make() {
      const d = makeDesign({
        name, preset: id, metal,
        slots: labels.map((label) => ({ label, group: label, code: 'white' })),
        parts: [{ tech, params: { lengthMm: BAND_MM, ...JSON.parse(JSON.stringify(params)) }, cells: null }],
      });
      applyColorway(d, colorways[0]);
      return d;
    },
  });
}

function addLoom({ id, group = 'Tkané obrázky', name, params, ways: colorways }) {
  addPeyote({ id, group, name, params: { w: 13, size: 11, n: colsForWrist(WRIST_DEFAULT, 1.6), loom: true, ...params }, colorways });
}

const picture = (name, colors) => ({ name, colors });
const fourTimes = (item) => [item, item, item, item];

addLoom({
  id: 'tkane-srdce', name: 'Tkaná srdíčka', params: { kind: 'pixels', items: fourTimes('heart'), split: true, splitGroup: 'Srdíčka', gap: 3 },
  ways: [
    picture('Čtyři barvy', { Podklad: 'pearl', Srdíčka: ['royal', 'hot', 'turq', 'amber'] }),
    picture('Na půlnoční', { Podklad: 'navy', Srdíčka: ['pink', 'sky', 'yellow', 'lilac'] }),
  ],
});
addLoom({
  id: 'kocicky', name: 'Kočičky', params: { kind: 'pixels', items: fourTimes('cat'), split: true, splitGroup: 'Kočičky', gap: 4 },
  ways: [
    picture('Zrzka, šedka a spol.', { Podklad: 'paleblue', Kočičky: ['orange', 'gray', 'black', 'cream'], Oči: 'emerald', Čumáčky: 'pink' }),
    picture('Barevné', { Podklad: 'cream', Kočičky: ['lilac', 'turq', 'hot', 'amber'], Oči: 'black', Čumáčky: 'raspberry' }),
  ],
});
addLoom({
  id: 'jahody', name: 'Jahody', params: { kind: 'pixels', items: fourTimes('strawberry'), gap: 4 },
  ways: [
    picture('Zralé', { Podklad: 'cream', Lístky: 'green', Jahody: 'red', Semínka: 'paleyellow' }),
    picture('Na mátové', { Podklad: 'mint', Lístky: 'emerald', Jahody: 'hot', Semínka: 'white' }),
  ],
});
addLoom({
  id: 'muchomurky', name: 'Muchomůrky', params: { kind: 'pixels', items: fourTimes('mushroom'), gap: 4 },
  ways: [
    picture('Z lesa', { Podklad: 'forest', Klobouky: 'red', 'Tečky a nožky': 'white' }),
    picture('Pohádkové', { Podklad: 'lavender', Klobouky: 'purple', 'Tečky a nožky': 'paleyellow' }),
  ],
});
addLoom({
  id: 'motyli', name: 'Motýli', params: { kind: 'pixels', items: fourTimes('butterfly'), gap: 4 },
  ways: [
    picture('Luční', { Podklad: 'pistachio', 'Horní křídla': 'hot', 'Spodní křídla': 'amber', Tělíčka: 'black' }),
    picture('Modrásek', { Podklad: 'white', 'Horní křídla': 'royal', 'Spodní křídla': 'sky', Tělíčka: 'navy' }),
  ],
});
addLoom({
  id: 'tulipany', name: 'Tulipány', params: { kind: 'pixels', items: Array(5).fill('tulip'), split: true, splitGroup: 'Květy', gap: 3 },
  ways: [picture('Jarní', { Podklad: 'paleblue', Květy: ['red', 'yellow', 'hot', 'purple', 'orange'], Stonky: 'green' })],
});
addLoom({
  id: 'rybicky', name: 'Rybičky', params: { kind: 'pixels', items: fourTimes('fish'), split: true, splitGroup: 'Rybky', gap: 3 },
  ways: [picture('V moři', { Podklad: 'cobalt', Rybky: ['amber', 'hot', 'lime', 'orange'], Oči: 'black', Ploutve: 'white' })],
});
addLoom({
  id: 'hvezdicky', name: 'Hvězdičky', params: { kind: 'pixels', items: Array(5).fill('star'), split: true, splitGroup: 'Hvězdy', gap: 2 },
  ways: [picture('Noční obloha', { Podklad: 'navy', Hvězdy: ['gold', 'paleyellow', 'gold', 'paleyellow', 'gold'] })],
});
addLoom({
  id: 'smajlici', name: 'Smajlíci', params: { kind: 'pixels', items: fourTimes('smile'), gap: 3 },
  ways: [picture('Veselí', { Podklad: 'paleblue', Obličeje: 'yellow', Úsměvy: 'black' })],
});
addLoom({
  id: 'zviratka', name: 'Mix obrázků', params: { kind: 'pixels', items: ['cat', 'tulip', 'butterfly', 'sun', 'fish'], gap: 3 },
  ways: [picture('Na zahradě', { Podklad: 'cream', Kočičky: 'orange', Oči: 'emerald', Čumáčky: 'pink', Květy: 'red', Stonky: 'green', 'Horní křídla': 'purple', 'Spodní křídla': 'lilac', Tělíčka: 'black', Sluníčka: 'yellow', Paprsky: 'amber', Rybky: 'turq', Ploutve: 'royal' })],
});

const tartan = (name, a, b, c) => picture(name, { Podklad: a, Pruh: b, Linka: c });
addLoom({
  id: 'tartan', group: 'Tkané vzory', name: 'Skotská kostka', params: { kind: 'tartan' },
  ways: [tartan('Královská', 'royal', 'forest', 'yellow'), tartan('Růžová', 'blush', 'raspberry', 'white'), tartan('Podzimní', 'cream', 'berry', 'amber')],
});
const steps4 = (name, ...codes) => picture(name, Object.fromEntries(['Podklad', 'Střed', 'První lem', 'Druhý lem', 'Třetí lem'].map((k, i) => [k, codes[i]])));
addLoom({
  id: 'azteky', group: 'Tkané vzory', name: 'Aztécké stupně', params: { kind: 'aztec' },
  ways: [steps4('Slunce a tyrkys', 'black', 'gold', 'turq', 'red', 'cream'), steps4('Pastel', 'white', 'lilac', 'pink', 'paleblue', 'mint')],
});
const barvy = (name, ...codes) => picture(name, Object.fromEntries(codes.map((code, i) => [`Barva ${i + 1}`, code])));
addLoom({
  id: 'ikat', group: 'Tkané vzory', name: 'Ikat', params: { kind: 'ikat' },
  ways: [barvy('Indigo', 'navy', 'white', 'sky'), barvy('Rozpité víno', 'berry', 'blush', 'amber')],
});
const sky = (name, ...codes) => picture(name, Object.fromEntries(['Obloha nahoře', 'Obloha uprostřed', 'Obloha u obzoru', 'Slunce', 'Vzdálené kopce', 'Blízké kopce'].map((k, i) => [k, codes[i]])));
addLoom({
  id: 'krajina', group: 'Tkané vzory', name: 'Krajina', params: { kind: 'landscape' },
  ways: [sky('Západ slunce', 'purple', 'hot', 'orange', 'yellow', 'berry', 'navy'), sky('Letní den', 'sky', 'paleblue', 'white', 'yellow', 'emerald', 'green'), sky('Noc', 'navy', 'cobalt', 'deep', 'pearl', 'forest', 'black')],
});

addTech({ id: 'rybi-pruhy', group: 'Rybí kost', name: 'Rybí kost s pruhy', tech: 'herringbone', params: { pairs: 3 }, labels: ['Barva 1', 'Barva 2', 'Barva 3'], ways: [['Moře', 'cobalt', 'turq', 'white'], ['Malina', 'raspberry', 'blush', 'gold']] });
addTech({ id: 'rybi-cikcak', group: 'Rybí kost', name: 'Rybí kost s cik-cakem', tech: 'herringbone', params: { pairs: 4, mode: 'zigzag', band: 4 }, labels: ['Barva 1', 'Barva 2', 'Barva 3'], ways: [['Oheň', 'red', 'orange', 'yellow'], ['Les', 'forest', 'green', 'pistachio']] });
addTech({ id: 'rybi-bloky', group: 'Rybí kost', name: 'Rybí kost s bloky', tech: 'herringbone', params: { pairs: 3, mode: 'blocks', band: 8 }, labels: ['Barva 1', 'Barva 2', 'Barva 3'], ways: [['Čokoláda', 'brown', 'cream', 'gold'], ['Bonbón', 'pink', 'aqua', 'yellow']] });
addTech({ id: 'raw', group: 'Další stehy', name: 'Pravoúhlé čtverečky', tech: 'raw', params: { rows: 2 }, labels: ['Podélné korálky', 'Příčné korálky', 'Středy'], ways: [['Perly a zlato', 'stonepearl', 'stonepearl', 'gold'], ['Dvoubarevné', 'turq', 'royal', 'yellow'], ['Černé a stříbrné', 'black', 'silver', 'silver']] });
addTech({ id: 'petrohrad', group: 'Další stehy', name: 'Petrohradský řetěz', tech: 'petersburg', labels: ['Střed', 'Lístky', 'Špičky'], ways: [['Větvička', 'emerald', 'green', 'amber'], ['Zlatý', 'gold', 'galvgold', 'cream'], ['Půlnoční', 'navy', 'silver', 'sky']] });

addTech({ id: 'spirala', group: 'Provazy', name: 'Spirálový provaz', tech: 'spiral', labels: ['Jádro', 'Spirála', 'Akcenty'], ways: [['Moře', 'teal', 'turq', 'gold'], ['Západ slunce', 'berry', 'orange', 'yellow'], ['Černá a zlatá', 'black', 'black', 'gold']] });
addTech({ id: 'provaz-spirala', group: 'Provazy', name: 'Háčkovaný provaz, spirála', tech: 'rope', params: { mode: 'spiral', colors: 3 }, labels: ['Barva 1', 'Barva 2', 'Barva 3'], ways: [['Lízátko', 'hot', 'white', 'turq'], ['Medová', 'amber', 'brown', 'cream']] });
addTech({ id: 'provaz-pruhy', group: 'Provazy', name: 'Háčkovaný provaz, proužky', tech: 'rope', params: { mode: 'bands', colors: 3, band: 4 }, labels: ['Barva 1', 'Barva 2', 'Barva 3'], ways: [['Námořnický', 'navy', 'white', 'red'], ['Pastel', 'paleblue', 'blush', 'paleyellow']] });
addTech({ id: 'provaz-melir', group: 'Provazy', name: 'Háčkovaný provaz, melír', tech: 'rope', params: { mode: 'mix', colors: 3, around: 8 }, labels: ['Barva 1', 'Barva 2', 'Barva 3'], ways: [['Tyrkysový', 'turq', 'aqua', 'white'], ['Fialový', 'purple', 'lilac', 'orchid']] });
addTech({ id: 'strapaty', group: 'Třásně', name: 'Střapatý z kapek', tech: 'fringe', params: { colors: 3 }, labels: ['Kapky 1', 'Kapky 2', 'Kapky 3', 'Šňůrka'], ways: [['Mořská tráva', 'emerald', 'turq', 'lime', 'black'], ['Růžový', 'hot', 'pink', 'blush', 'white'], ['Sněhový', 'white', 'paleblue', 'silver', 'white']] });
addTech({ id: 'strapaty-pruhy', group: 'Třásně', name: 'Střapatý s pruhy', tech: 'fringe', params: { colors: 3, mode: 'bands', band: 44 }, labels: ['Kapky 1', 'Kapky 2', 'Kapky 3', 'Šňůrka'], ways: [['Duhový', 'hot', 'yellow', 'turq', 'black'], ['Podzim', 'red', 'amber', 'brown', 'black']] });

addTech({ id: 'kyticky', group: 'Kytičky', name: 'Kytičkový řetěz', tech: 'daisy', labels: ['Okvětí', 'Středy', 'Spojky'], ways: [['Kopretiny', 'white', 'amber', 'green'], ['Pomněnky', 'sky', 'yellow', 'white'], ['Sedmikrásky', 'blush', 'yellow', 'emerald']] });
addTech({ id: 'kyticky-husto', group: 'Kytičky', name: 'Husté kytičky', tech: 'daisy', params: { links: 1 }, labels: ['Okvětí', 'Středy', 'Spojky'], ways: [['Levandule', 'lilac', 'white', 'purple'], ['Vlčí mák', 'red', 'black', 'emerald']] });
addTech({ id: 'kyticky-dve', group: 'Kytičky', name: 'Louka ve dvou řadách', tech: 'daisy', params: { rows: 2, links: 3 }, labels: ['Okvětí', 'Středy', 'Spojky'], ways: [['Louka', 'hot', 'yellow', 'green'], ['Zimní', 'white', 'silver', 'paleblue']] });
addTech({ id: 'sitka', group: 'Krajka', name: 'Krajková síťka', tech: 'net', params: { rows: 3 }, labels: ['Síť', 'Uzly', 'Druhá řada'], ways: [['Tyrkys a zlato', 'turq', 'gold', 'turq'], ['Černá krajka', 'black', 'silver', 'black'], ['Perlová', 'white', 'stonepearl', 'white']] });
addTech({ id: 'sitka-uzka', group: 'Krajka', name: 'Úzká síťka', tech: 'net', params: { rows: 2, edge: 2, twoTone: true }, labels: ['Síť', 'Uzly', 'Druhá řada'], ways: [['Růže', 'raspberry', 'gold', 'blush'], ['Moře', 'royal', 'white', 'aqua']] });

addTech({ id: 'makrame', group: 'Makramé', name: 'Makramé s kuličkami', tech: 'macrame', params: { balls: 5, knots: 3 }, labels: ['Kuličky', 'Šňůrka', 'Koncové korálky'], ways: [['Černá a zlatá', 'gold', 'black', 'gold'], ['Tyrkys a hnědá', 'turq', 'brown', 'turq'], ['Perly', 'stonepearl', 'navy', 'stonepearl']] });
addTech({ id: 'makrame-velke', group: 'Makramé', name: 'Makramé s velkými kuličkami', tech: 'macrame', params: { balls: 3, knots: 5, big: true }, labels: ['Kuličky', 'Šňůrka', 'Koncové korálky'], ways: [['Hematit', 'hematite', 'black', 'hematite'], ['Měsíční kámen', 'moon', 'silver', 'moon'], ['Amazonit', 'amazonite', 'cream', 'amazonite']] });

addTech({ id: 'mozaika', group: 'Destičky Tila', name: 'Mozaika z Tila', tech: 'tilagrid', params: { rows: 2 }, labels: ['Destičky A', 'Destičky B', 'Okraje'], ways: [['Šachovnice', 'black', 'white', 'silver'], ['Pastel', 'blush', 'paleblue', 'gold'], ['Moře', 'turq', 'cobalt', 'white']] });
addTech({ id: 'mozaika-rada', group: 'Destičky Tila', name: 'Tila v jedné řadě', tech: 'tilagrid', params: { rows: 1 }, labels: ['Destičky A', 'Destičky B', 'Okraje'], ways: [['Zlato a krém', 'cream', 'gold', 'gold'], ['Bonbón', 'hot', 'aqua', 'white']] });
addTech({ id: 'zebricek', group: 'Tyčinky', name: 'Žebříček z tyčinek', tech: 'ladder', params: { colors: 3 }, labels: ['Tyčinky 1', 'Tyčinky 2', 'Tyčinky 3', 'Okraje'], ways: [['Stříbrný s modrou', 'silver', 'royal', 'sky', 'silver'], ['Zlatý', 'gold', 'black', 'cream', 'gold'], ['Západ slunce', 'orange', 'hot', 'yellow', 'berry']] });
addTech({ id: 'zebricek-kratky', group: 'Tyčinky', name: 'Úzký žebříček', tech: 'ladder', params: { colors: 2, short: true, seq: [0, 1] }, labels: ['Tyčinky 1', 'Tyčinky 2', 'Okraje'], ways: [['Černobílý', 'black', 'white', 'silver'], ['Lila', 'lilac', 'purple', 'gold']] });
addTech({ id: 'tyckovy-cikcak', group: 'Tyčinky', name: 'Cik-cak z tyčinek', tech: 'buglezig', labels: ['Tyčinky', 'Špičky'], ways: [['Kovový', 'silver', 'royal'], ['Korálový', 'coral', 'gold']] });
addTech({ id: 'tyckove-kosoctverce', group: 'Tyčinky', name: 'Kosočtverce z tyčinek', tech: 'buglezig', params: { double: true }, labels: ['Tyčinky', 'Špičky'], ways: [['Zlaté', 'gold', 'cream'], ['Tyrkysové', 'turq', 'gold'], ['Fialové', 'purple', 'silver']] });
addTech({ id: 'pismenka', group: 'Navlékané', name: 'Kostky s písmeny', tech: 'letters', params: { text: 'LÁSKA' }, labels: ['Kostky', 'Písmena', 'Korálky', 'Akcenty'], ways: [['Klasické', 'white', 'black', 'turq', 'gold'], ['Růžové', 'blush', 'raspberry', 'pink', 'white'], ['Černé', 'black', 'white', 'silver', 'gold']] });

const strandOf = (id, name, labels, strands, rows) => addTech({
  id, group: 'Navlékané', name, tech: 'strand', labels, ways: rows,
  params: { lengthMm: BAND_MM + 4, strands: strands.map((seq) => ({ seq })) },
});
strandOf('krystaly', 'Krystaly a perly', ['Krystaly', 'Perly', 'Rokajly'], [[[0, 1, 'bicone4'], [2, 3], [1, 1, 'round4'], [2, 3]]], [['Rubínové', 'red', 'stonepearl', 'gold'], ['Ametyst', 'purple', 'stonepearl', 'silver'], ['Zimní', 'silkblue', 'stonepearl', 'silver']]);
strandOf('krychlicky', 'Krychličky', ['Krychličky A', 'Krychličky B', 'Mezery'], [[[0, 2, 'cube4'], [2, 2], [1, 2, 'cube4'], [2, 2]]], [['Moře', 'turq', 'royal', 'gold'], ['Bonbón', 'hot', 'yellow', 'white']]);
strandOf('tycinky', 'Tyčinky a rokajly', ['Tyčinky', 'Rokajly', 'Akcenty'], [[[0, 1, 'bugle6'], [1, 2], [2, 1, 'round3'], [1, 2]], [[1, 3], [0, 1, 'bugle6'], [1, 3]]], [['Stříbro a modrá', 'silver', 'cobalt', 'gold'], ['Zlato a černá', 'gold', 'black', 'cream']]);
strandOf('perly', 'Perly se zlatem', ['Perly', 'Mezery', 'Kuličky'], [[[0, 1, 'round6'], [1, 2], [2, 1, 'round3'], [1, 2]]], [['Krémové', 'stonepearl', 'gold', 'gold'], ['Měsíční', 'moon', 'silver', 'silver']]);
strandOf('tri-duha', 'Tři prameny v duze', ['Pramen 1', 'Pramen 2', 'Pramen 3', 'Kuličky'], [[[0, 40], [3, 1, 'round3']], [[1, 30], [3, 1, 'round3']], [[2, 36], [3, 1, 'round3']]], [['Duha', 'hot', 'yellow', 'turq', 'gold'], ['Ledová', 'white', 'paleblue', 'silver', 'silver'], ['Lesní', 'emerald', 'olive', 'brown', 'gold']]);

export const PATTERNS = list;
export const patternById = (id) => list.find((p) => p.id === id);
export const DEFAULT_PATTERN = 'srdce-mezi';

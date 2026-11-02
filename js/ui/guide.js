// Everything a maker needs on paper: materials, chart and the thread order row by row.
import { TECHNIQUES, materials, bandLengthMm, FINDINGS_MM } from '../core/design.js';
import { threadPasses, runLength, beadDims, bandSize, grid, DEFAULT_SIZE } from '../techniques/peyote.js';
import { strandBeads } from '../techniques/strand.js';
import { SHAPES } from '../core/shapes.js';
import { czName, bead } from '../core/catalog.js';
import { el, icon, beadSwatch, displayCode, czNumber, flatColor, plural } from './util.js';
import { drawChart } from './chart.js';

const METAL_LABEL = { steel: 'chirurgická ocel', rose: 'růžové zlato', gold: 'zlatá', dark: 'tmavá', none: 'bez spony' };

function materialTable(design) {
  const lines = materials(design);
  const rows = lines.map((l) => el('tr', {},
    el('td', {}, el('div', { class: 'mat-name' }, beadSwatch(l.code), el('div', {},
      el('span', { class: 'code' }, displayCode(l.code) || czName(l.code)),
      el('small', {}, `${displayCode(l.code) ? `${czName(l.code)} · ` : ''}${l.material}`),
    ))),
    el('td', { class: 'hint' }, l.labels.join(', ')),
    el('td', { class: 'num' }, l.noCount ? 'podle délky' : czNumber(l.count, 0)),
    el('td', { class: 'num' }, l.noCount ? '' : `${czNumber(Math.max(l.grams, 0.1), 1)} g`),
  ));
  const total = lines.reduce((sum, l) => sum + (l.noCount ? 0 : l.count), 0);
  return el('table', { class: 'mat-table' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Korálek'), el('th', {}, 'Kde'), el('th', { class: 'num' }, 'Kusů'), el('th', { class: 'num' }, 'Váha'))),
    el('tbody', {}, rows, el('tr', {}, el('td', { colspan: 2 }, el('b', {}, 'Celkem')), el('td', { class: 'num' }, el('b', {}, czNumber(total, 0))), el('td', { class: 'num' }, ''))),
  );
}

function peyoteGuide(design, part, draws) {
  const { w, n } = grid(part);
  const { label } = beadDims(part);
  const size = bandSize(part);
  const canvas = el('canvas', { class: 'chart-canvas' });
  const scroller = el('div', { class: 'chart-scroll' }, canvas);
  draws.push(() => {
    const cell = Math.max(7.5, Math.min(20, (scroller.clientWidth - 40) / (n + 0.5)));
    drawChart(canvas, design, part, { cell });
  });
  const passes = threadPasses(part);
  const swatch = (slot) => el('i', { class: 'dot', style: { background: flatColor(design.slots[slot].code) } });
  return [
    el('h3', {}, 'Rozměr'),
    el('p', {}, `${w} korálků na šířku, ${n} na délku, Delica ${label}. To je asi ${czNumber(size.width / 10)} × ${czNumber(size.length / 10)} cm.`),
    el('h3', {}, 'Schéma'),
    scroller,
    el('h3', {}, 'Postup po řadách'),
    el('ol', { class: 'steps' }, TECHNIQUES.peyote.mod.steps(part).map((s) => el('li', {}, s))),
    el('details', {},
      el('summary', { class: 'linkish' }, `Zobrazit všech ${passes.length} řad korálek po korálku`),
      el('div', { class: 'passes' }, passes.map((p) => el('div', { class: 'pass' },
        el('b', {}, `${p.label} ${p.dir}`),
        el('span', { class: 'runs' }, runLength(p.slots).map((run) => el('span', { class: 'run' }, swatch(run.slot), `${run.count}×`))),
      ))),
    ),
  ];
}

function strandGuide(design, part) {
  const items = part.params.strands.map((strand, i) => {
    const { beads } = strandBeads(strand, strand.lengthMm ?? part.params.lengthMm);
    return el('div', { class: 'strand' },
      el('h3', {}, `Pramen ${i + 1}`, el('span', { class: 'hint' }, `${beads.length} ${plural(beads.length, 'korálek', 'korálky', 'korálků')}`)),
      el('div', { class: 'seq' }, 'Opakuj: ', strand.seq.map(([slot, count, shape]) => el('span', { class: 'seq-item' }, beadSwatch(design.slots[slot].code), ` ${count}× ${shape ? SHAPES[shape].label : ''}`))),
    );
  });
  return [el('h3', {}, 'Pořadí navlékání'), items, el('p', { class: 'hint' }, 'Sekvenci opakuj, dokud nemáš požadovanou délku.')];
}

function stepsGuide(part) {
  return [el('h3', {}, 'Postup'), el('ol', { class: 'steps' }, TECHNIQUES[part.tech].mod.steps(part).map((s) => el('li', {}, s)))];
}

// Returns a function that redraws the charts, for when the theme changes.
export function renderGuide(container, design, { onPrint } = {}) {
  const draws = [];
  const parts = design.parts.flatMap((part) => {
    if (part.tech === 'peyote') return peyoteGuide(design, part, draws);
    if (part.tech === 'strand') return strandGuide(design, part);
    return stepsGuide(part);
  });
  const hasDelica15 = design.parts.some((p) => p.tech === 'peyote' && (p.params.size ?? DEFAULT_SIZE) === 15);
  const hasEstimate = design.parts.some((p) => p.tech !== 'peyote');
  const usesCodes = design.slots.some((s) => !bead(s.code).extra);
  container.replaceChildren(
    el('div', { class: 'guide' },
      el('div', { class: 'guide-head' },
        el('h2', {}, design.name),
        el('button', { class: 'btn small no-print', onclick: onPrint }, icon('print'), 'Vytisknout návod'),
      ),
      design.note ? el('p', {}, el('b', {}, 'Poznámka: '), design.note) : null,
      el('p', {}, `Zápěstí ${czNumber(design.wrist)} cm. Korálková část asi ${czNumber(bandLengthMm(design.wrist) / 10)} cm, zbytek (${czNumber(FINDINGS_MM / 10)} cm) tvoří spona a kroužky. Komponenty: ${METAL_LABEL[design.metal] ?? design.metal}.`),
      el('h3', {}, 'Materiál'),
      materialTable(design),
      usesCodes ? el('div', { class: 'note-card' },
        hasDelica15
          ? 'Kódy jsou z katalogu Miyuki Delica 11/0 (DB). U velikosti 15/0 (DBS) mají korálky stejné číslo, ale ne každá barva se v ní vyrábí, takže dostupnost před nákupem ověř. Odstín na obrazovce je přibližný.'
          : 'Kódy jsou z katalogu Miyuki Delica. Odstín na obrazovce je přibližný, před nákupem si ho ověř na vzorníku.',
        hasEstimate ? ' Rokajly a destičky mají vlastní číslování, tady je u nich kód jen přibližný odstín.' : null,
      ) : null,
      parts,
    ),
  );
  const redraw = () => draws.forEach((draw) => draw());
  redraw();
  return redraw;
}

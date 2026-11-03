// Composing a band: which pictures are on it, in what order, and how they sit along it.
// The row of tiles picks a picture, and the tabs below say what happens to it.
import { store } from './store.js';
import { setFigures, applyMotifSettings } from '../core/design.js';
import { hasFigures, figuresOf, fittedWidth, placeFigures, beadDims, BEAD_SIZES, DEFAULT_SIZE } from '../techniques/peyote.js';
import { isDrawn } from '../core/drawn.js';
import { motifOf } from '../core/motifs.js';
import { pixelOf } from '../core/pixels.js';
import { LETTERS, letterShape } from '../core/letters.js';
import { figureThumb, builtInFigures, myShapes, keepShape, forgetShape } from './figures.js';
import { ShapeDraw } from './draw.js';
import { el, fill, icon, flatColor, czNumber, plural, toast } from './util.js';

const LAYOUTS = [
  ['center', 'Uprostřed', 'Motivy pohromadě uprostřed pásu'],
  ['spread', 'Rovnoměrně', 'Motivy rozprostřené po celé délce se stejnými mezerami'],
  ['repeat', 'Dokola', 'Řada motivů se opakuje po celé délce'],
];
const SPACERS = {
  brick: [['', 'Žádný'], ['dot', 'Malý křížek'], ['cross', 'Velký křížek'], ['heartS', 'Malé srdce']],
  grid: [['', 'Žádný'], ['dot', 'Malý křížek'], ['cross', 'Velký křížek']],
};
const FIRST_SHAPE = { brick: 'heartN', grid: 'heart' };
const MAX_FIGURES = 24;

const beads = (n) => `${n} ${plural(n, 'korálek', 'korálky', 'korálků')}`;

export class Composer {
  constructor({ selectSlot, openTab }) {
    this.selectSlot = selectSlot;
    this.openTab = openTab;
    this.bar = el('section', { class: 'figure-bar' });
    this.shapes = el('div', { class: 'side-panel' });
    this.layout = el('div', { class: 'side-panel' });
    this.drawing = null;
  }

  // The one sewn or woven band of a design, if it has one.
  get part() {
    const { parts } = store.design;
    return parts.length === 1 && parts[0].tech === 'peyote' ? parts[0] : null;
  }

  get figurePart() {
    const part = this.part;
    return part && hasFigures(part.params) ? part : null;
  }

  get ids() {
    return figuresOf(this.figurePart.params);
  }

  get loom() {
    return !!this.figurePart.params.loom;
  }

  // The picture being edited: an index, or -1 when none or all of them are selected.
  get selected() {
    const i = store.selected - 1;
    return !store.allInGroup && i >= 0 && i < this.ids.length ? i : -1;
  }

  get allSelected() {
    const i = store.selected - 1;
    return store.allInGroup && i >= 0 && i < this.ids.length;
  }

  render(kind) {
    if ((kind === 'load' || kind === 'undo') && this.drawing) this._closeDrawing();
    this._renderBar();
    if (!this.shapes.hidden) this._renderShapes();
    if (!this.layout.hidden && kind !== 'meta') this._renderLayout();
  }

  // --- Changes ---

  _list() {
    return this.ids.map((id, from) => ({ id, from }));
  }

  _change(list, select) {
    const part = this.figurePart;
    store.snapshot();
    if (part.cells) toast('Ruční úpravy ve schématu se přepočítaly. Vrátí je tlačítko Zpět.', 4000);
    const width = part.params.w;
    const reframe = list.length !== this.ids.length || list.some((f, i) => f.from !== i);
    setFigures(store.design, part, list);
    store.selected = select === 'all' ? 1 : select + 1;
    store.allInGroup = select === 'all' && list.length > 1;
    store.notify(reframe || part.params.w !== width ? 'geometry' : 'structure');
  }

  _add() {
    const list = this._list();
    if (list.length >= MAX_FIGURES) return;
    const shape = this.ids[this.selected] ?? this.ids[this.ids.length - 1];
    if (!shape) {
      this.openTab('shape');
      return;
    }
    list.push({ id: shape, from: null });
    this._change(list, list.length - 1);
  }

  _remove(i) {
    const list = this._list();
    list.splice(i, 1);
    this._change(list, list.length ? Math.min(i, list.length - 1) : -1);
  }

  _copy(i) {
    const list = this._list();
    if (list.length >= MAX_FIGURES) return;
    list.splice(i + 1, 0, { ...list[i] });
    this._change(list, i + 1);
  }

  _move(from, to) {
    const list = this._list();
    if (to < 0 || to >= list.length || from === to) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    this._change(list, to);
  }

  _setShape(id) {
    const list = this._list();
    if (!list.length) {
      this._change([{ id, from: null }], 0);
      return;
    }
    const one = this.selected;
    if (one >= 0) list[one].id = id;
    else for (const f of list) f.id = id;
    this._change(list, one >= 0 ? one : 'all');
  }

  // --- Tiles ---

  _partColor(i, name) {
    const { slots } = store.design;
    if (!name) return flatColor(slots[i + 1].code);
    return flatColor(slots.find((s) => s.group === name)?.code ?? 'DB0721');
  }

  _renderBar() {
    const part = this.figurePart;
    this.bar.hidden = !part;
    if (!part) return;
    const { slots } = store.design;
    const one = this.selected;
    const tiles = this.ids.map((id, i) => {
      const label = slots[i + 1].label;
      const on = one === i || this.allSelected;
      return el('button', {
        class: `tile${on ? ' on' : ''}`, title: `${label}. Klepnutím vybereš, tažením přesuneš.`, 'aria-label': label, 'aria-pressed': String(on),
        style: { background: flatColor(slots[0].code) },
        'data-index': i,
      }, figureThumb(this.loom, id, (name) => this._partColor(i, name)));
    });
    const row = el('div', { class: `figure-row${this.drawing ? ' locked' : ''}` }, tiles,
      el('button', { class: 'tile add', title: 'Přidat motiv', 'aria-label': 'Přidat motiv', disabled: this.ids.length >= MAX_FIGURES, onclick: () => this._add() }, icon('plus')));
    this._dragging(row, tiles);
    const action = (name, label, fn, disabled = false) => el('button', { class: 'tool small', title: label, 'aria-label': label, disabled, onclick: fn }, icon(name));
    const actions = one >= 0 && !this.drawing ? el('div', { class: 'figure-actions' },
      action('left', 'Posunout doleva', () => this._move(one, one - 1), one === 0),
      action('right', 'Posunout doprava', () => this._move(one, one + 1), one === this.ids.length - 1),
      action('copy', 'Zdvojit', () => this._copy(one), this.ids.length >= MAX_FIGURES),
      action('x', 'Odebrat', () => this._remove(one))) : null;
    const { overflow } = placeFigures(part.params);
    fill(this.bar,
      el('div', { class: 'section-title' }, el('h2', {}, 'Na náramku'), actions),
      row,
      !this.ids.length ? el('p', { class: 'hint' }, 'Zatím je tu prázdný pás. Vyber první motiv v záložce Tvary, nebo si ho nakresli.') : null,
      overflow ? el('p', { class: 'layout-note warn' }, `Nevejdou se, chybí ${beads(overflow)}. Uber motiv, nebo prodluž náramek v Detailech.`) : null,
    );
  }

  // A tile follows the finger: tap selects, a drag moves the picture to where it is let go.
  _dragging(row, tiles) {
    let drag = null;
    const order = () => tiles.slice().sort((a, b) => a.style.order - b.style.order);
    for (const tile of tiles) {
      const index = Number(tile.dataset.index);
      tile.addEventListener('pointerdown', (e) => {
        drag = { index, to: index, x: e.clientX, y: e.clientY, moved: false };
        tile.setPointerCapture(e.pointerId);
        tiles.forEach((t, i) => { t.style.order = i; });
      });
      tile.addEventListener('pointermove', (e) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
        drag.moved = true;
        tile.classList.add('dragging');
        const over = tiles.find((t) => {
          if (t === tile) return false;
          const r = t.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        });
        if (!over) return;
        const list = order();
        const to = list.indexOf(over);
        list.splice(to, 0, list.splice(list.indexOf(tile), 1)[0]);
        list.forEach((t, i) => { t.style.order = i; });
        drag.to = to;
      });
      tile.addEventListener('pointerup', () => {
        if (!drag) return;
        const { moved, to } = drag;
        drag = null;
        tile.classList.remove('dragging');
        if (moved) {
          if (to === index) tiles.forEach((t) => { t.style.order = ''; });
          else this._move(index, to);
          return;
        }
        this.selectSlot(index + 1);
      });
      tile.addEventListener('pointercancel', () => {
        drag = null;
        tile.classList.remove('dragging');
        tiles.forEach((t) => { t.style.order = ''; });
      });
    }
  }

  // --- Shapes ---

  _renderShapes() {
    if (this.drawing) return;
    const part = this.figurePart;
    if (!part) return;
    const { loom, ids } = this;
    const one = this.selected;
    const current = one >= 0 ? ids[one] : new Set(ids).size === 1 ? ids[0] : null;
    const color = (name) => (name ? 'var(--accent-text)' : 'currentColor');
    const letters = new Set(LETTERS.map((l) => letterShape(l, loom)));
    const mine = [...new Set([...myShapes(loom), ...ids.filter((id) => isDrawn(id) && !letters.has(id))])];
    const choice = (id, label, removable) => el('div', { class: 'figure-cell' },
      el('button', {
        class: `figure-choice${current === id ? ' on' : ''}`, title: label, 'aria-label': label, 'aria-pressed': String(current === id),
        onclick: () => this._setShape(id),
      }, figureThumb(loom, id, color)),
      removable ? el('button', {
        class: 'figure-forget', title: 'Odebrat z Mých tvarů', 'aria-label': 'Odebrat z Mých tvarů',
        onclick: () => {
          forgetShape(id);
          this._renderShapes();
        },
      }, icon('x')) : null);
    const target = one >= 0 ? store.design.slots[one + 1].label : ids.length ? 'všechny motivy najednou' : 'první motiv';
    fill(this.shapes,
      el('p', { class: 'hint figure-target' }, 'Měníš: ', el('b', {}, target)),
      el('div', { class: 'figure-grid' }, builtInFigures(loom).map((f) => choice(f.id, f.label))),
      el('h3', { class: 'way-set' }, 'Moje tvary'),
      el('div', { class: 'figure-grid' },
        el('button', { class: 'figure-choice figure-new', title: 'Nakreslit nový tvar', onclick: () => this._startDrawing(false) }, icon('brush'), 'Nový'),
        current ? el('button', { class: 'figure-choice figure-new', title: 'Upravit vybraný tvar, původní zůstane', onclick: () => this._startDrawing(true) }, icon('copy'), 'Upravit') : null,
        mine.map((id) => choice(id, 'Vlastní tvar', myShapes(loom).includes(id)))),
      el('h3', { class: 'way-set' }, 'Písmena, třeba iniciály'),
      el('div', { class: 'letter-grid' }, LETTERS.map((letter) => {
        const id = letterShape(letter, loom);
        return el('button', { class: `letter${current === id ? ' on' : ''}`, 'aria-pressed': String(current === id), onclick: () => this._setShape(id) }, letter);
      })),
    );
  }

  // --- Drawing ---

  _startDrawing(fromCurrent) {
    const part = this.figurePart;
    const { loom, ids } = this;
    const one = this.selected;
    const source = ids[one >= 0 ? one : 0];
    const art = fromCurrent && source ? (loom ? pixelOf(source) : motifOf(source)).art : null;
    const { D, L } = beadDims(part);
    const { slots } = store.design;
    store.snapshot();
    const editor = new ShapeDraw({
      grid: loom, art, ratio: L / D,
      ground: flatColor(slots[0].code),
      main: flatColor(slots[(one >= 0 ? one : 0) + 1]?.code ?? 'DB1110'),
      center: flatColor(slots.find((s) => s.group === 'Středy')?.code ?? 'DB0721'),
      onChange: (id) => this._drawn(id),
      onDone: () => this._finishDrawing(true),
      onCancel: () => this._finishDrawing(false),
    });
    this.drawing = { editor, one, last: null };
    this.shapes.closest('.side').classList.add('drawing');
    this.shapes.replaceChildren(editor.dom);
    editor.draw();
    this._renderBar();
  }

  // Goes on the bracelet straight away, all of it one step for the Back button.
  _drawn(id) {
    const part = this.figurePart;
    const list = this._list();
    const { one } = this.drawing;
    if (!list.length) {
      list.push({ id, from: null });
      this.drawing.one = 0;
    } else if (one >= 0) {
      list[one].id = id;
    } else {
      for (const f of list) f.id = id;
    }
    this.drawing.last = id;
    const width = part.params.w;
    setFigures(store.design, part, list);
    store.selected = (this.drawing.one >= 0 ? this.drawing.one : 0) + 1;
    store.allInGroup = this.drawing.one < 0 && list.length > 1;
    store.notify(part.params.w !== width ? 'geometry' : 'structure');
  }

  _closeDrawing() {
    this.drawing.editor.destroy();
    this.drawing = null;
    this.shapes.closest('.side').classList.remove('drawing');
  }

  _finishDrawing(keep) {
    const { last } = this.drawing;
    this._closeDrawing();
    if (keep && last) {
      keepShape(last);
    } else if (last) {
      store.undo();
      store.future.pop();
    } else {
      store.past.pop();
    }
    this._renderBar();
    this._renderShapes();
  }

  // --- Layout ---

  _note(p) {
    if (!hasFigures(p) || !figuresOf(p).length) return null;
    const placed = placeFigures(p);
    const { D } = beadDims({ params: p });
    if (placed.overflow) return el('p', { class: 'layout-note warn' }, `Nevejdou se, chybí ${beads(placed.overflow)}. Uber motiv, nebo prodluž náramek v Detailech.`);
    const lines = [];
    if ((p.layout ?? 'center') === 'center') {
      lines.push(`Od kraje zbývá ${czNumber((placed.margin * D) / 10)} cm na každé straně.`);
      if (placed.gap < (p.gap ?? 2)) lines.push(`Mezery se zmenšily na ${placed.gap}, jinak by se motivy nevešly.`);
    } else {
      if (placed.times > 1) lines.push(`Řada se opakuje ${placed.times}×.`);
      lines.push(`Mezery vycházejí na ${beads(placed.gap)}.`);
    }
    const fitted = fittedWidth(p);
    if (p.w === fitted) lines.push(p.frame ? 'Mezi motivem a lemem je jedna volná řada.' : 'Nad motivem i pod ním je jedna volná řada.');
    return el('p', { class: 'layout-note' }, lines.join(' '));
  }

  _renderLayout() {
    const part = this.part;
    if (!part) return;
    const p = part.params;
    const update = (changes) => {
      store.snapshot();
      applyMotifSettings(store.design, part, changes);
      store.selected = Math.min(store.selected, store.design.slots.length - 1);
      store.notify('geometry');
    };
    const stepper = (label, key, value, min, max, step = 1) => el('div', { class: 'field' }, label,
      el('div', { class: 'stepper' },
        el('button', { 'aria-label': `${label}, méně`, disabled: value - step < min, onclick: () => update({ [key]: value - step }) }, '−'),
        el('output', {}, String(value)),
        el('button', { 'aria-label': `${label}, více`, disabled: value + step > max, onclick: () => update({ [key]: value + step }) }, '+')));
    const select = (label, options, current, change) => el('label', { class: 'field' }, label,
      el('select', { class: 'input', onchange: (e) => change(e.target.value) },
        options.map(([value, text]) => el('option', { value, selected: String(current) === String(value) }, text))));
    const pictures = hasFigures(p);
    const layout = p.layout ?? 'center';
    const fitted = fittedWidth(p);
    fill(this.layout,
      pictures ? el('div', { class: 'field' }, 'Rozložení motivů',
        el('div', { class: 'segmented', role: 'group' }, LAYOUTS.map(([id, label, title]) => el('button', {
          class: layout === id ? 'on' : '', title, 'aria-pressed': String(layout === id), onclick: () => update({ layout: id }),
        }, label)))) : null,
      el('div', { class: 'field-row' },
        pictures && layout !== 'spread' ? stepper(layout === 'repeat' ? 'Nejmenší mezera' : 'Mezery', 'gap', p.gap ?? 2, 0, 30) : null,
        pictures ? stepper('Barevné konce', 'ends', p.ends ?? 0, 0, 6) : null,
        pictures ? select('Mezičlánek', SPACERS[p.loom ? 'grid' : 'brick'], p.spacer ?? '', (v) => update({ spacer: v || null })) : null,
        pictures ? select('Lem nahoře a dole', [[0, 'Žádný'], [1, '1 řada'], [2, '2 řady']], p.frame ?? 0, (v) => update({ frame: Number(v) })) : null,
        // Around a picture the width moves by two rows, so the free rows above and below stay equal.
        stepper('Šířka v řadách', 'w', p.w, 5, 25, pictures ? 2 : 1),
        select('Velikost korálků', Object.entries(BEAD_SIZES).map(([v, def]) => [v, def.label]), p.size ?? DEFAULT_SIZE, (v) => update({ size: Number(v) })),
        select('Tvar konců', [[0, 'Rovné'], [1, 'Špička ke sponě']], p.taper ? 1 : 0, (v) => update({ taper: v === '1' })),
      ),
      // Below the controls: it changes length with them, and must not push them from under the pointer.
      this._note(p),
      fitted && p.w !== fitted ? el('button', { class: 'linkish', onclick: () => update({ w: fitted }) }, `Vrátit šířku podle motivu, ${fitted} řad`) : null,
      el('p', { class: 'hint' }, `Délka ${beads(p.n)} se počítá ze zápěstí ${czNumber(store.design.wrist)} cm.`,
        part.cells ? ' Změna rozložení vzor přepočítá a ruční kreslení přepíše. Vrátit se dá tlačítkem Zpět ve schématu.' : null),
    );
  }
}

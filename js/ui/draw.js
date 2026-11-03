// A small canvas for drawing a shape, on the same lattice the band is made on. Every finished
// stroke goes straight onto the bracelet, so the shape is judged where it will really sit.
import { encodeDrawn } from '../core/drawn.js';
import { el, icon } from './util.js';

const EMPTY = 0;
const MAIN = 1;
const CENTER = 2;
const COLS = { grid: 15, brick: 13 };
const ROWS = 13;

export class ShapeDraw {
  constructor({ grid, art, ratio, ground, main, center, onChange, onDone, onCancel }) {
    Object.assign(this, { grid, ratio, ground, main, center, onChange });
    this.tool = MAIN;
    this.mirror = !art;
    this.history = [];
    const height = art?.length ?? 0;
    this.R = Math.max(ROWS, height + (height % 2 === ROWS % 2 ? 0 : 1));
    this.C = grid ? COLS.grid : COLS.brick;
    this.cells = new Uint8Array(this.R * this.C);
    if (art) this._load(art);

    this.canvas = el('canvas', { class: 'draw-canvas', 'aria-label': 'Plátno pro kreslení tvaru' });
    this.tools = el('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Nástroje kreslení' });
    this.info = el('p', { class: 'hint' });
    this.dom = el('div', { class: 'draw-panel' },
      el('div', { class: 'section-title' }, el('h2', {}, 'Vlastní tvar')),
      el('p', { class: 'hint' }, 'Kresli přímo do mřížky. Po každém tahu se tvar ukáže na náramku.'),
      this.tools,
      el('div', { class: 'draw-frame' }, this.canvas),
      this.info,
      el('div', { class: 'draw-actions' },
        el('button', { class: 'btn', onclick: onCancel }, 'Zrušit'),
        el('button', { class: 'btn primary', onclick: onDone }, 'Hotovo')),
    );

    this.canvas.addEventListener('pointerdown', (e) => this._down(e));
    this.canvas.addEventListener('pointermove', (e) => this._move(e));
    this.canvas.addEventListener('pointerup', () => this._up());
    this.canvas.addEventListener('pointercancel', () => this._up());
    this._keys = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        this._undo();
      }
    };
    window.addEventListener('keydown', this._keys, { capture: true });
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(this.dom);
    this._renderTools();
  }

  destroy() {
    window.removeEventListener('keydown', this._keys, { capture: true });
    this.resize.disconnect();
  }

  _valid(r, c) {
    return r >= 0 && r < this.R && c >= 0 && c < this.C - (!this.grid && r % 2 ? 1 : 0);
  }

  // Puts an existing shape in the middle of the canvas, keeping it on the lattice.
  _load(art) {
    const beads = [];
    art.forEach((line, row) => {
      for (let p = 0; p < line.length; p++) if (line[p] === '#' || line[p] === 'o') beads.push({ row, p, value: line[p] === 'o' ? CENTER : MAIN });
    });
    const left = Math.min(...beads.map((b) => b.p));
    const right = Math.max(...beads.map((b) => b.p));
    if (this.grid) {
      const shift = Math.floor((this.C - 1 - (right - left)) / 2) - left;
      const top = Math.floor((this.R - art.length) / 2);
      for (const b of beads) this._set(top + b.row, b.p + shift, b.value);
      return;
    }
    // In half beads the axis of the canvas is C - 1, and each row only has every other position.
    const shift = this.C - 1 - Math.floor((left + right) / 2);
    let top = Math.floor((this.R - art.length) / 2);
    const first = beads[0];
    if ((first.p + shift) % 2 !== (top + first.row) % 2) top += top + art.length < this.R ? 1 : -1;
    for (const b of beads) {
      const r = top + b.row;
      this._set(r, (b.p + shift - r % 2) / 2, b.value);
    }
  }

  _set(r, c, value) {
    if (this._valid(r, c)) this.cells[r * this.C + c] = value;
  }

  _mirrored(r, c) {
    return [r, this.C - 1 - c - (!this.grid && r % 2 ? 1 : 0)];
  }

  art() {
    const art = [];
    for (let r = 0; r < this.R; r++) {
      const chars = [];
      for (let c = 0; c < this.C; c++) {
        const value = this._valid(r, c) ? this.cells[r * this.C + c] : EMPTY;
        const ch = value === CENTER ? 'o' : value === MAIN ? '#' : null;
        if (this.grid) chars.push(ch ?? '.');
        else if (ch) chars[2 * c + r % 2] = ch;
      }
      art.push(Array.from(chars, (x) => x ?? ' ').join(''));
    }
    return art;
  }

  _size() {
    let top = Infinity;
    let bottom = -1;
    let left = Infinity;
    let right = -1;
    for (let r = 0; r < this.R; r++) {
      for (let c = 0; c < this.C; c++) {
        if (!this.cells[r * this.C + c]) continue;
        const x = this.grid ? c : c + (r % 2) / 2;
        top = Math.min(top, r);
        bottom = Math.max(bottom, r);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    return bottom < 0 ? null : { rows: bottom - top + 1, cols: Math.ceil(right - left) + 1 };
  }

  _renderTools() {
    const tool = (value, label, content) => el('button', {
      class: `tool${this.tool === value ? ' on' : ''}`, title: label, 'aria-pressed': String(this.tool === value),
      onclick: () => {
        this.tool = value;
        this._renderTools();
      },
    }, content, label);
    this.tools.replaceChildren(
      tool(MAIN, 'Tvar', icon('brush')),
      tool(CENTER, 'Střed', el('i', { class: 'draw-dot', style: { background: this.center } })),
      tool(EMPTY, 'Guma', icon('erase')),
      el('button', {
        class: `tool${this.mirror ? ' on' : ''}`, title: 'Co nakreslíš vlevo, přibude i vpravo', 'aria-pressed': String(this.mirror),
        onclick: () => {
          this.mirror = !this.mirror;
          this._renderTools();
          this.draw();
        },
      }, icon('mirror'), 'Souměrně'),
      el('button', { class: 'tool', title: 'Vrátí poslední tah', 'aria-label': 'Vrátit tah', disabled: !this.history.length, onclick: () => this._undo() }, icon('undo')),
      el('button', {
        class: 'tool', title: 'Vymaže celé plátno', 'aria-label': 'Vymazat plátno', disabled: !this.cells.some(Boolean),
        onclick: () => {
          this._remember();
          this.cells.fill(EMPTY);
          this._commit();
        },
      }, icon('x')),
    );
  }

  draw() {
    const available = this.canvas.parentElement?.clientWidth;
    if (!available) return;
    const cw = Math.min(30, available / this.C);
    const ch = cw * this.ratio;
    const width = Math.round(cw * this.C);
    const height = Math.ceil(ch * this.R);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    this.geom = { cw, ch };
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const colors = { [EMPTY]: this.ground, [MAIN]: this.main, [CENTER]: this.center };
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(0 0 0 / .2)';
    for (let r = 0; r < this.R; r++) {
      for (let c = 0; c < this.C; c++) {
        if (!this._valid(r, c)) continue;
        const x = (c + (!this.grid && r % 2 ? 0.5 : 0)) * cw;
        const y = r * ch;
        ctx.beginPath();
        ctx.roundRect(x + 0.75, y + 0.75, cw - 1.5, ch - 1.5, Math.min(cw, ch) * 0.2);
        ctx.fillStyle = colors[this.cells[r * this.C + c]];
        ctx.fill();
        ctx.stroke();
      }
    }
    if (this.mirror) {
      const x = ((this.C - 1) / 2 + 0.5) * cw;
      ctx.setLineDash([5, 4]);
      for (const [color, offset] of [['rgb(255 255 255 / .85)', 0], ['rgb(0 0 0 / .55)', 1]]) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + offset, 0);
        ctx.lineTo(x + offset, height);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const size = this._size();
    this.info.textContent = size
      ? `Tvar má ${size.rows} × ${size.cols} korálků, šířka pásu se mu přizpůsobí sama.`
      : 'Zatím prázdné plátno. Na náramku zůstává původní tvar.';
  }

  _at(e) {
    const rect = this.canvas.getBoundingClientRect();
    const r = Math.floor((e.clientY - rect.top) / this.geom.ch);
    const c = Math.floor((e.clientX - rect.left) / this.geom.cw - (!this.grid && r % 2 ? 0.5 : 0));
    return this._valid(r, c) ? { r, c } : null;
  }

  _paint({ r, c }) {
    this._set(r, c, this.value);
    if (this.mirror) this._set(...this._mirrored(r, c), this.value);
  }

  _remember() {
    this.history.push(this.cells.slice());
    if (this.history.length > 50) this.history.shift();
  }

  _down(e) {
    const at = this._at(e);
    if (!at) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this._remember();
    // A stroke that starts on its own colour rubs out, so one tool does for most drawing.
    this.value = this.cells[at.r * this.C + at.c] === this.tool ? EMPTY : this.tool;
    this.stroke = at;
    this._paint(at);
    this.draw();
  }

  _move(e) {
    if (!this.stroke) return;
    const at = this._at(e);
    if (!at) return;
    const from = this.stroke;
    const steps = Math.max(Math.abs(at.c - from.c), Math.abs(at.r - from.r));
    for (let i = 1; i <= steps; i++) {
      this._paint({ r: Math.round(from.r + ((at.r - from.r) * i) / steps), c: Math.round(from.c + ((at.c - from.c) * i) / steps) });
    }
    this.stroke = at;
    this.draw();
  }

  _up() {
    if (!this.stroke) return;
    this.stroke = null;
    this._commit();
  }

  _undo() {
    if (!this.history.length) return;
    this.cells = this.history.pop();
    this._commit();
  }

  _commit() {
    this._renderTools();
    this.draw();
    const id = encodeDrawn(this.art(), this.grid);
    if (id) this.onChange(id);
  }
}

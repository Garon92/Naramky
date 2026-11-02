// The flat pattern chart. This is where a maker paints bead by bead. Rows sit offset
// by half a bead just like the real peyote weave, so what is drawn is what is sewn.
import { NONE, grid, ensureCells, floodFill, mirrorCell, beadDims } from '../techniques/peyote.js';
import { MOTIFS, parseMotif, placeMotif } from '../core/motifs.js';
import { store } from './store.js';
import { el, icon, flatColor, toast } from './util.js';

const PAD_LEFT = 26;
const PAD_TOP = 22;

export function drawChart(canvas, design, part, { cell, hover = [], ghostSlot = null, labels = true } = {}) {
  const { w, n, cells } = grid(part);
  const { D, L } = beadDims(part);
  const cw = cell;
  const ch = cell * (L / D);
  const pad = labels ? { x: PAD_LEFT, y: PAD_TOP } : { x: 2, y: 2 };
  const width = Math.ceil(pad.x + (n + 0.5) * cw + 4);
  const height = Math.ceil(pad.y + w * ch + 4);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const colors = design.slots.map((s) => flatColor(s.code));
  const line = cell >= 9 ? 'rgb(30 20 30 / .3)' : 'rgb(30 20 30 / .14)';
  for (let r = 0; r < w; r++) {
    const y = pad.y + r * ch;
    const shift = r % 2 ? cw / 2 : 0;
    for (let c = 0; c < n; c++) {
      const slot = cells[r * n + c];
      if (slot === NONE) continue;
      const x = pad.x + c * cw + shift;
      ctx.fillStyle = colors[slot] ?? colors[0];
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = line;
      ctx.lineWidth = 0.75;
      ctx.strokeRect(x + 0.375, y + 0.375, cw - 0.75, ch - 0.75);
    }
  }
  if (labels) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
    ctx.font = '600 10.5px Figtree, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const every = cell < 9 ? 20 : 10;
    for (let c = every - 1; c < n; c += every) ctx.fillText(String(c + 1), pad.x + (c + 0.5) * cw, 10);
    ctx.textAlign = 'right';
    const rowEvery = ch < 9 ? 2 : 1;
    for (let r = 0; r < w; r += rowEvery) ctx.fillText(String(r + 1), PAD_LEFT - 6, pad.y + (r + 0.5) * ch);
  }
  // Hover and stamp preview.
  for (const { r, c } of hover) {
    const x = pad.x + c * cw + (r % 2 ? cw / 2 : 0);
    const y = pad.y + r * ch;
    if (ghostSlot !== null) {
      ctx.fillStyle = colors[ghostSlot] ?? '#000';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x, y, cw, ch);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, cw - 1.5, ch - 1.5);
  }
  return { cw, ch, pad, w, n };
}

const TOOLS = [
  { id: 'brush', icon: 'brush', label: 'Štětec', key: 'b' },
  { id: 'fill', icon: 'fill', label: 'Výplň', key: 'f' },
  { id: 'erase', icon: 'erase', label: 'Guma, vrátí podklad', key: 'e' },
  { id: 'pick', icon: 'drop', label: 'Kapátko', key: 'i' },
  { id: 'stamp', icon: 'stamp', label: 'Razítko s motivem', key: 's' },
  { id: 'hand', icon: 'hand', label: 'Posun', key: 'h' },
];

export class ChartEditor {
  constructor(container, part, { onChange } = {}) {
    this.part = part;
    this.onChange = onChange;
    this.tool = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820 ? 'hand' : 'brush';
    this.mirrorX = false;
    this.mirrorY = false;
    this.motif = 'heartS';
    this.hover = [];
    this.dom = el('div');
    container.append(this.dom);
    this._build();
  }

  setPart(part) {
    this.part = part;
    this.draw();
  }

  _build() {
    this.toolbar = el('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Nástroje kreslení' });
    this.canvas = el('canvas', { class: 'chart-canvas' });
    this.scroll = el('div', { class: 'chart-scroll' }, this.canvas);
    this.dom.append(this.toolbar, this.scroll);
    this._renderToolbar();

    this.canvas.addEventListener('pointerdown', (e) => this._down(e));
    this.canvas.addEventListener('pointermove', (e) => this._move(e));
    this.canvas.addEventListener('pointerup', () => this._up());
    this.canvas.addEventListener('pointercancel', () => this._up());
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.painting) {
        this.hover = [];
        this.draw();
      }
    });
    new ResizeObserver(() => this.draw()).observe(this.scroll);
    this._keys = (e) => this._onKey(e);
    document.addEventListener('keydown', this._keys);
  }

  destroy() {
    document.removeEventListener('keydown', this._keys);
  }

  _renderToolbar() {
    const bar = this.toolbar;
    const items = [
      ...TOOLS.map((t) => el('button', {
        class: `tool${this.tool === t.id ? ' on' : ''}`, title: `${t.label} (${t.key.toUpperCase()})`, 'aria-label': t.label, 'aria-pressed': String(this.tool === t.id),
        onclick: () => this.setTool(t.id),
      }, icon(t.icon))),
      this.tool === 'stamp' ? el('select', {
        class: 'tool', 'aria-label': 'Motiv razítka',
        onchange: (e) => { this.motif = e.target.value; },
      }, Object.entries(MOTIFS).map(([id, m]) => el('option', { value: id, selected: id === this.motif }, m.label))) : null,
      el('span', { class: 'sep' }),
      el('button', {
        class: `tool${this.mirrorX ? ' on' : ''}`, title: 'Zrcadlit zleva doprava', 'aria-pressed': String(this.mirrorX),
        onclick: () => { this.mirrorX = !this.mirrorX; this._renderToolbar(); },
      }, icon('mirror'), '↔'),
      el('button', {
        class: `tool${this.mirrorY ? ' on' : ''}`, title: 'Zrcadlit shora dolů', 'aria-pressed': String(this.mirrorY),
        onclick: () => { this.mirrorY = !this.mirrorY; this._renderToolbar(); },
      }, icon('mirror'), '↕'),
      el('span', { class: 'sep' }),
      el('button', { class: 'tool', title: 'Zpět (Ctrl+Z)', 'aria-label': 'Zpět', disabled: !store.past.length, onclick: () => store.undo() }, icon('undo')),
      el('button', { class: 'tool', title: 'Znovu (Ctrl+Shift+Z)', 'aria-label': 'Znovu', disabled: !store.future.length, onclick: () => store.redo() }, icon('redo')),
    ];
    bar.replaceChildren(...items.filter(Boolean));
    this.canvas.style.touchAction = this.tool === 'hand' ? 'auto' : 'none';
    this.canvas.style.cursor = this.tool === 'hand' ? 'grab' : 'crosshair';
  }

  refreshToolbar() {
    this._renderToolbar();
  }

  setTool(id) {
    this.tool = id;
    this._renderToolbar();
  }

  _onKey(e) {
    if (e.target.matches('input, textarea, select')) return;
    if (!this.dom.isConnected || this.dom.closest('[hidden]')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod) return;
    const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
    if (t) this.setTool(t.id);
  }

  draw() {
    const avail = this.scroll.clientWidth - PAD_LEFT - 8;
    const { n } = this.part.params;
    const fit = avail / (n + 0.5);
    const min = navigator.maxTouchPoints > 0 ? 15 : 9;
    this.cell = Math.max(min, Math.min(26, fit));
    const ghost = this.tool === 'stamp' && this.hover.length > 1 ? store.selected : null;
    this.geom = drawChart(this.canvas, store.design, this.part, { cell: this.cell, hover: this.hover, ghostSlot: ghost });
  }

  _cellAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const { cw, ch, pad, w, n } = this.geom;
    const x = e.clientX - rect.left - pad.x;
    const y = e.clientY - rect.top - pad.y;
    const r = Math.floor(y / ch);
    if (r < 0 || r >= w) return null;
    const c = Math.floor((x - (r % 2 ? cw / 2 : 0)) / cw);
    if (c < 0 || c >= n) return null;
    return { r, c };
  }

  _stampCells(at) {
    const m = parseMotif(this.motif);
    const X = 2 * at.c + (at.r % 2);
    const top = at.r - Math.floor(m.rows / 2);
    return placeMotif(this.motif, X, top, this.part.params.w, this.part.params.n);
  }

  _paint(at) {
    const { w, n } = this.part.params;
    const cells = ensureCells(this.part);
    const value = this.tool === 'erase' ? 0 : store.selected;
    let changed = false;
    for (const [r, c] of mirrorCell(at.r, at.c, w, n, this.mirrorX, this.mirrorY)) {
      if (cells[r * n + c] !== NONE && cells[r * n + c] !== value) {
        cells[r * n + c] = value;
        changed = true;
      }
    }
    if (changed) this.onChange?.();
  }

  _line(from, to) {
    const steps = Math.max(Math.abs(to.c - from.c), Math.abs(to.r - from.r));
    for (let i = 1; i <= steps; i++) {
      this._paint({ r: Math.round(from.r + ((to.r - from.r) * i) / steps), c: Math.round(from.c + ((to.c - from.c) * i) / steps) });
    }
  }

  _down(e) {
    if (this.tool === 'hand') return;
    const at = this._cellAt(e);
    if (!at) return;
    const { w, n } = this.part.params;
    if (this.tool === 'pick') {
      const slot = grid(this.part).cells[at.r * n + at.c];
      if (slot !== NONE) {
        store.selected = slot;
        store.notify('meta');
        this.setTool('brush');
        toast(`Vybráno: ${store.design.slots[slot].label}`);
      }
      return;
    }
    store.snapshot();
    if (this.tool === 'fill') {
      const cells = ensureCells(this.part);
      if (cells[at.r * n + at.c] !== NONE) {
        floodFill(cells, w, n, at.r, at.c, store.selected);
        this.onChange?.();
      }
      return;
    }
    if (this.tool === 'stamp') {
      const cells = ensureCells(this.part);
      for (const { r, c } of this._stampCells(at)) cells[r * n + c] = store.selected;
      this.onChange?.();
      return;
    }
    this.painting = true;
    this.last = at;
    this.canvas.setPointerCapture?.(e.pointerId);
    this._paint(at);
  }

  _move(e) {
    if (this.tool === 'hand') return;
    const at = this._cellAt(e);
    if (this.painting && at) {
      this._line(this.last, at);
      this.last = at;
    }
    if (this.tool === 'stamp') this.hover = at ? this._stampCells(at) : [];
    else this.hover = at ? [at] : [];
    this.draw();
  }

  _up() {
    this.painting = false;
  }
}

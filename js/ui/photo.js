// Hosts the one photo stage on the designer page. Loaded lazily with the 3D engine.
import { sceneSpec, focusSpan } from '../core/design.js';

export const VIEWS = [
  { id: 'motif', label: 'Vzor' },
  { id: 'macro', label: 'Detail' },
  { id: 'whole', label: 'Celý' },
  { id: 'loop', label: 'Kruh' },
];

export class PhotoHost {
  constructor(wrap, { onTapBead } = {}) {
    this.wrap = wrap;
    this.onTapBead = onTapBead;
    this.view = 'motif';
    this.stage = null;
    this.failed = false;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-grab';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Fotorealistický náhled náramku. Táhnutím se dá otáčet.');
    wrap.prepend(this.canvas);
    this.ready = this._boot();
  }

  async _boot() {
    try {
      const { Stage } = await import('../engine/stage.js');
      this.stage = new Stage(this.canvas);
    } catch (err) {
      console.error(err);
      this.failed = true;
      this.canvas.remove();
      const msg = document.createElement('div');
      msg.className = 'stage-fallback';
      msg.textContent = 'Tenhle prohlížeč neumí 3D náhled (WebGL). Barvy i schéma ale fungují dál.';
      this.wrap.prepend(msg);
      return;
    }
    new ResizeObserver(() => this._resize()).observe(this.wrap);
    this._resize();
    // Plain wheel keeps scrolling the page, if it has anywhere to go. Otherwise it zooms the
    // photo, as Ctrl or pinch always does.
    this.canvas.addEventListener('wheel', (e) => {
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight;
      if (pageScrolls && !e.ctrlKey && !e.metaKey) e.stopImmediatePropagation();
    }, { capture: true });
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 7 || !quick || !this.spec) return;
      const rect = this.canvas.getBoundingClientRect();
      const hit = this.stage.pick(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
      if (hit.index >= 0 && hit.dist < 26) this.onTapBead?.(this.spec.instances[hit.index]);
    });
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.wrap;
    if (!w || !h || !this.stage) return;
    if (w === this.lastW && h === this.lastH) return;
    this.lastW = w;
    this.lastH = h;
    this.stage.resize(w, h);
    if (this.spec) this.frame();
  }

  show(design, { reframe = false } = {}) {
    if (!this.stage) return;
    this.design = design;
    const spec = sceneSpec(design);
    spec.poseKind = this.view === 'loop' ? 'loop' : 'bow';
    this.spec = spec;
    this.stage.setSurface(design.surface);
    this.stage.setBracelet(spec);
    if (reframe) this.frame();
  }

  setView(id) {
    this.view = id;
    if (this.design) this.show(this.design, { reframe: true });
  }

  frame() {
    const s = this.stage;
    const spec = this.spec;
    if (!s || !spec) return;
    const f = focusSpan(this.design);
    const portrait = this.lastH > this.lastW * 0.9;
    switch (this.view) {
      case 'loop': {
        const diameter = (spec.length + 8) / Math.PI;
        const need = (diameter + spec.width) * 1.25;
        s.frameView({ sCenter: 0, span: need, tilt: 0.86, azimuth: 0.0, lookAtCenter: true, frameHeight: need * 0.82 });
        break;
      }
      case 'whole':
        s.frameView({ sCenter: 0, span: spec.length + 62, tilt: 0.42 });
        break;
      case 'macro':
        s.frameView({ sCenter: f ? f.center - f.span * 0.2 : 0, span: portrait ? 24 : 34, tilt: 0.5, azimuth: 0.18, frameHeight: 1 });
        break;
      default: {
        const span = f ? f.span : Math.min(spec.length, portrait ? 46 : 72);
        s.frameView({ sCenter: f ? f.center : 0, span, tilt: 0.3, azimuth: 0 });
      }
    }
  }

  async photoBlob(longSide = 2400, frames) {
    const s = this.stage;
    if (!s) return null;
    const { lastW: w, lastH: h } = this;
    const scale = longSide / Math.max(w, h);
    s.resize(w, h, scale);
    this.frame();
    s.renderStill(frames ?? Math.max(s.maxFrames, 96));
    const blob = await new Promise((res) => s.canvas.toBlob(res, 'image/jpeg', 0.93));
    s.resize(w, h);
    this.frame();
    return blob;
  }

  dataUrl() {
    return this.stage ? this.stage.canvas.toDataURL('image/jpeg', 0.9) : null;
  }
}

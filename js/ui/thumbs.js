// Gallery thumbnails. One hidden 3D stage renders them in turn, only when they scroll
// into view. Results are kept as small JPEGs, so 80 cards stay light on a phone.
import { clone, sceneSpec } from '../core/design.js';
import { compactColumns } from '../techniques/peyote.js';
import { el } from './util.js';

const PHONE = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820;
const W = PHONE ? 600 : 720;
const H = Math.round((W * 5.4) / 16);
const FRAMES = PHONE ? 6 : 14;
const cache = new Map();
const queue = [];
let stagePromise = null;
let running = false;

function getStage() {
  if (!stagePromise) {
    stagePromise = (async () => {
      const { Stage } = await import('../engine/stage.js');
      const canvas = el('canvas');
      const stage = new Stage(canvas, { quality: 'low', interactive: false, maxFrames: FRAMES });
      stage.camera.fov = 13;
      stage.aperture = 0.004;
      stage.resize(W, H, 1);
      stage.setSurface('backdrop');
      return stage;
    })().catch((err) => {
      console.error(err);
      return null;
    });
  }
  return stagePromise;
}

// Hearts sit closer together in a card, the way they read on the wrist.
function compact(design) {
  const d = clone(design);
  d.metal = 'none';
  for (const part of d.parts) {
    if (part.tech === 'peyote' && !part.cells) {
      if (part.params.kind === 'motifs') part.params.n = Math.min(part.params.n, compactColumns(part.params));
      else part.params.n = Math.min(part.params.n, 52);
    }
  }
  return d;
}

function renderInto(stage, item) {
  const d = compact(item.design);
  const spec = sceneSpec(d);
  spec.poseKind = 'flat';
  spec.findings = null;
  stage.setSurface(d.surface === 'backdrop' ? 'backdrop' : d.surface);
  stage.setBracelet(spec);
  const span = d.parts[0].tech === 'peyote' ? spec.length * 1.04 : Math.min(spec.length, 62);
  stage.frameView({ sCenter: 0, span, tilt: 0.3, fill: 0.96, frameHeight: 1 });
  stage.running = false;
  stage.renderStill(FRAMES);
  return new Promise((resolve) => {
    stage.canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : ''), 'image/jpeg', 0.86);
  });
}

async function pump() {
  if (running) return;
  running = true;
  const stage = await getStage();
  while (queue.length) {
    const item = queue.shift();
    if (!item.target.isConnected) continue;
    if (!cache.has(item.key)) {
      if (!stage) break;
      cache.set(item.key, await renderInto(stage, item));
      // Yield to the page. A timer too, because hidden tabs get no animation frames.
      await new Promise((r) => {
        requestAnimationFrame(() => setTimeout(r, 0));
        setTimeout(r, 120);
      });
    }
    paint(item);
  }
  running = false;
}

function paint(item) {
  const src = cache.get(item.key);
  if (src) item.target.src = src;
}

const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    io.unobserve(entry.target);
    const item = entry.target._thumb;
    if (cache.has(item.key)) paint(item);
    else {
      queue.push(item);
      pump();
    }
  }
}, { rootMargin: '250px' }) : null;

export function thumbImage(key, makeDesign) {
  const img = el('img', { class: 'thumb', alt: '' });
  const item = { key, target: img, get design() { return makeDesign(); } };
  img._thumb = item;
  if (io) io.observe(img);
  else {
    queue.push(item);
    pump();
  }
  return img;
}

export function forgetThumb(key) {
  const url = cache.get(key);
  if (url) URL.revokeObjectURL(url);
  cache.delete(key);
}

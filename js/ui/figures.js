// Small drawings of the pictures on a band, and the shapes kept in this browser.
import { MOTIFS, parseMotif } from '../core/motifs.js';
import { PIXELS, pixelOf } from '../core/pixels.js';
import { safeStorage } from './util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const KEY = 'naramky:shapes';
const MAX_SAVED = 60;

// Beads of a picture in bead units. part is null for the picture itself.
function beadsFor(loom, id) {
  if (!loom) return parseMotif(id).beads.map((b) => ({ x: b.x / 2, y: b.row, part: b.center ? 'Středy' : null }));
  const { art, legend } = pixelOf(id);
  const mainKey = Object.keys(legend)[0];
  const beads = [];
  art.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) if (line[x] !== '.') beads.push({ x, y, part: line[x] === mainKey ? null : legend[line[x]] });
  });
  return beads;
}

export function figureThumb(loom, id, colorOf) {
  const beads = beadsFor(loom, id);
  const paths = new Map();
  for (const b of beads) {
    const color = colorOf(b.part);
    paths.set(color, `${paths.get(color) ?? ''}M${b.x} ${(b.y * 0.88).toFixed(2)}h.9v.78h-.9z`);
  }
  const xs = beads.map((b) => b.x);
  const ys = beads.map((b) => b.y * 0.88);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'thumb');
  svg.setAttribute('aria-hidden', 'true');
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  svg.setAttribute('viewBox', `${minX - 0.1} ${minY - 0.1} ${Math.max(...xs) - minX + 1.1} ${Math.max(...ys) - minY + 0.98}`);
  for (const [color, d] of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', color);
    path.setAttribute('stroke', 'rgb(0 0 0 / .22)');
    path.setAttribute('stroke-width', '.05');
    svg.append(path);
  }
  return svg;
}

export const builtInFigures = (loom) => Object.entries(loom ? PIXELS : MOTIFS).map(([id, m]) => ({ id, label: m.label }));

function saved() {
  try {
    const list = JSON.parse(safeStorage.get(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const myShapes = (loom) => saved().filter((id) => id.startsWith(loom ? '~g' : '~b'));
export const keepShape = (id) => safeStorage.set(KEY, JSON.stringify([id, ...saved().filter((x) => x !== id)].slice(0, MAX_SAVED)));
export const forgetShape = (id) => safeStorage.set(KEY, JSON.stringify(saved().filter((x) => x !== id)));

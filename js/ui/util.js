// Small DOM helpers. No framework, the app is a handful of panels.
import { bead, czName } from '../core/catalog.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) node.style.setProperty(p, val);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name, cls = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// Display colour for flat swatches. Catalogue hex is a photo mean, so a touch dark.
export function flatColor(code) {
  const b = bead(code);
  const lift = b.finish === 'metal' || b.finish === 'metalMatte' ? 1.35 : 1.12;
  const n = parseInt(b.hex, 16);
  const ch = (v) => Math.min(255, Math.round(v * lift)).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

export function beadSwatch(code) {
  const b = bead(code);
  const cls = b.finish === 'metal' || b.finish === 'metalMatte' ? 'bead metal' : b.finish === 'matte' ? 'bead matte' : 'bead';
  return el('span', { class: cls, style: { '--c': flatColor(code) } });
}

export const displayCode = (code) => (code.startsWith('DB') ? code.replace(/^DB/, 'DB-') : '');
export const colorTitle = (code) => [displayCode(code), czName(code)].filter(Boolean).join(' · ');

let toastTimer;
export function toast(message, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export const czNumber = (n, digits = 1) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { style: { position: 'fixed', opacity: 0 } }, text);
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function saveFile(blob, filename) {
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const safeStorage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};

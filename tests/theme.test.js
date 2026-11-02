import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const light = tokens(':root');
const dark = tokens(":root[data-theme='dark']");

function rgb(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = value.match(/^rgb\((\d+) (\d+) (\d+)/);
  assert.ok(fn, `not a colour: ${value}`);
  return fn.slice(1, 4).map(Number);
}

function luminance(value) {
  const [r, g, b] = rgb(value).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text token on background token. Every pair must be readable in both themes.
const PAIRS = [
  ['ink', 'paper'], ['ink', 'card'], ['ink', 'surface'], ['on-ink', 'ink'],
  ['muted', 'paper'], ['muted', 'card'], ['muted', 'surface'],
  ['field-ink', 'card'], ['chip-ink', 'surface'], ['accent-ink', 'accent'],
  ['accent-text', 'card'], ['accent-text', 'paper'], ['ink', 'note-bg'],
  ['glass-ink', 'glass'], ['glass-sub', 'glass'],
];

for (const [name, theme] of [['light', light], ['dark', dark]]) {
  test(`${name} theme text is readable`, () => {
    for (const [text, bg] of PAIRS) {
      const ratio = contrast(theme[text], theme[bg]);
      assert.ok(ratio >= 4.5, `${text} on ${bg}: ${ratio.toFixed(2)}`);
    }
  });
}

test('both themes define the same colours', () => {
  const layout = ['radius', 'header'];
  const names = Object.keys(light).filter((n) => !layout.includes(n)).sort();
  assert.deepEqual(Object.keys(dark).sort(), names);
});

test('components use tokens instead of fixed text and background colours', () => {
  const rules = css.slice(css.indexOf('* { box-sizing'));
  const body = rules.slice(0, rules.indexOf('@media print'));
  // Beads are real objects and keep their own shading, so swatch rules are left out.
  const checked = body.split('\n').filter((line) => /background:|[^-]color:/.test(line) && !/\.bead|radial-gradient|linear-gradient/.test(line));
  const fixed = checked.filter((line) => /(background|[^-]color):\s*(#|rgb\(\d)/.test(line) && !/stage-fallback|render-note|::backdrop/.test(line));
  assert.deepEqual(fixed, []);
});

// Light or dark. Follows the system until someone picks, then remembers the choice.
// The first paint is decided by a small script in index.html using the same key.
import { icon, safeStorage } from './util.js';

const KEY = 'naramky:theme';
const META = { light: '#f3eee6', dark: '#16121a' };
const root = document.documentElement;
const listeners = new Set();

export const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function apply(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = META[theme];
  for (const fn of listeners) fn(theme);
}

function saved() {
  const value = safeStorage.get(KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export function initTheme(button) {
  const system = matchMedia('(prefers-color-scheme: dark)');
  const paint = () => {
    const toDark = currentTheme() === 'light';
    const label = toDark ? 'Zapnout tmavý režim' : 'Zapnout světlý režim';
    button.replaceChildren(icon(toDark ? 'moon' : 'sun'));
    button.title = label;
    button.setAttribute('aria-label', label);
  };
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    safeStorage.set(KEY, next);
    apply(next);
    paint();
  });
  system.addEventListener('change', () => {
    if (saved()) return;
    apply(system.matches ? 'dark' : 'light');
    paint();
  });
  // Paper is always light, whatever the screen shows.
  let before = null;
  window.addEventListener('beforeprint', () => {
    before = currentTheme();
    apply('light');
  });
  window.addEventListener('afterprint', () => {
    if (before) apply(before);
    before = null;
  });
  paint();
}

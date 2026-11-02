// Light, dark, or following the system, which is what happens until someone picks.
// The first paint is decided by a small script in index.html using the same key.
import { icon, safeStorage, toast } from './util.js';

const KEY = 'naramky:theme';
const META = { light: '#f3eee6', dark: '#16121a' };
const MODES = { system: { icon: 'auto', label: 'podle systému' }, light: { icon: 'sun', label: 'světlý' }, dark: { icon: 'moon', label: 'tmavý' } };
const ORDER = Object.keys(MODES);
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

function savedMode() {
  const value = safeStorage.get(KEY);
  return value === 'dark' || value === 'light' ? value : 'system';
}

export function initTheme(button) {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let mode = savedMode();
  const paint = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    const label = `Vzhled: ${MODES[mode].label}. Další klepnutí: ${MODES[next].label}.`;
    button.replaceChildren(icon(MODES[mode].icon));
    button.title = label;
    button.setAttribute('aria-label', label);
  };
  const follow = () => apply(mode === 'system' ? (system.matches ? 'dark' : 'light') : mode);
  button.addEventListener('click', () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    safeStorage.set(KEY, mode);
    follow();
    paint();
    toast(`Vzhled: ${MODES[mode].label}`);
  });
  system.addEventListener('change', () => {
    if (mode === 'system') follow();
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

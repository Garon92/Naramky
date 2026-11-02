import { store, restoreSession } from './ui/store.js';
import { decodeDesign } from './core/design.js';
import { toast } from './ui/util.js';
import { renderGallery, renderMine } from './ui/gallery.js';
import { Designer } from './ui/designer.js';
import { initTheme } from './ui/theme.js';

const app = document.getElementById('app');
let designer = null;

function setActive(route) {
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('on', a.dataset.route === route);
}

function leaveDesigner() {
  if (designer) {
    designer.destroy();
    designer = null;
  }
}

function openDesign(design, options) {
  const kept = store.open(design, options);
  if (kept) toast(`Rozpracovaný návrh je v Moje návrhy jako „${kept}“.`);
  location.hash = '#/';
}

function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/n/')) {
    try {
      const design = decodeDesign(hash.slice(4));
      const kept = store.open(design);
      toast(kept ? `Otevřený návrh: ${design.name}. Ten tvůj je v Moje návrhy jako „${kept}“.` : `Otevřený návrh: ${design.name}`, kept ? 5000 : undefined);
    } catch (err) {
      console.warn(err);
      toast('Tenhle odkaz na návrh nejde přečíst.');
    }
    history.replaceState(null, '', '#/');
  }
  const path = (location.hash || '#/').replace(/^#/, '');
  if (path.startsWith('/vzory')) {
    leaveDesigner();
    setActive('gallery');
    renderGallery(app, { openDesign });
    window.scrollTo({ top: 0 });
    return;
  }
  if (path.startsWith('/moje')) {
    leaveDesigner();
    setActive('mine');
    renderMine(app, { openDesign });
    window.scrollTo({ top: 0 });
    return;
  }
  setActive('design');
  if (!designer) designer = new Designer(app);
  window.naramky = { store, designer };
}

initTheme(document.getElementById('theme-toggle'));
restoreSession();
window.addEventListener('hashchange', route);
route();

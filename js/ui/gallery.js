// Ready-made patterns, and the designs saved in this browser.
import { PATTERNS, COLLECTIONS, patternById } from '../core/presets.js';
import { decodeDesign } from '../core/design.js';
import { flatColor, el, icon, plural, toast, copyText } from './util.js';
import { thumbImage, forgetThumb } from './thumbs.js';
import {
  store, savedList, deleteSaved, deleteAllSaved, duplicateSaved, linkFromData, NO_LINK,
  draftList, openDraft, saveDraft, deleteDraft, DRAFT_NOTE, DRAFT_LIMIT,
} from './store.js';

function colorDots(design) {
  const seen = [];
  for (const s of design.slots) if (!seen.includes(s.code)) seen.push(s.code);
  return el('span', { class: 'dots' }, seen.slice(0, 6).map((code) => el('i', { style: { background: flatColor(code) } })));
}

let collection = COLLECTIONS[0].id;

export function renderGallery(root, { openDesign }) {
  const content = el('div');
  const tabs = el('div', { class: 'coll-tabs', role: 'tablist' });
  const hint = el('p', { class: 'hint' });
  const blank = el('div');

  const draw = () => {
    tabs.replaceChildren(...COLLECTIONS.map((c) => {
      const count = PATTERNS.filter((p) => !p.hidden && c.groups.includes(p.group)).length;
      return el('button', {
        class: collection === c.id ? 'on' : '', role: 'tab', 'aria-selected': String(collection === c.id),
        onclick: () => {
          collection = c.id;
          draw();
          window.scrollTo({ top: 0 });
        },
      }, c.label, el('small', {}, String(count)));
    }));
    const meta = COLLECTIONS.find((c) => c.id === collection);
    hint.textContent = meta.hint;
    blank.replaceChildren(meta.blank ? el('button', { class: 'btn start-blank', onclick: () => openDesign(patternById(meta.blank).make()) }, icon('brush'), 'Složit vlastní od prázdného pásu') : '');
    const groups = meta.groups.map((group) => [group, PATTERNS.filter((p) => !p.hidden && p.group === group)]);
    content.replaceChildren(...groups.flatMap(([group, list]) => [
      el('h2', { class: 'group-title' }, group, el('small', {}, `${list.length} ${plural(list.length, 'vzor', 'vzory', 'vzorů')}`)),
      el('div', { class: 'grid' }, list.map((p) => {
        const design = p.make();
        return el('button', { class: 'card', onclick: () => openDesign(p.make()) },
          thumbImage(p.id, () => p.make()),
          el('span', { class: 'meta' },
            el('span', {}, el('b', {}, p.name), p.colorways.length > 1 ? el('small', {}, `${p.colorways.length} ${plural(p.colorways.length, 'barevná kombinace', 'barevné kombinace', 'barevných kombinací')}`) : null),
            colorDots(design)),
        );
      })),
    ]));
  };

  root.replaceChildren(el('div', { class: 'page' },
    el('header', { class: 'page-head' },
      el('div', {},
        el('h1', {}, 'Vzory'),
        el('p', {}, 'Vzor je tvar. Barvy si v něm pak zvolíš po svém, nebo si vybereš z připravených kombinací.'),
      ),
    ),
    tabs, hint, blank, content,
    el('p', { class: 'hint', style: { marginTop: '34px' } },
      'Barvy korálků: ', el('a', { href: 'https://makebead.com', rel: 'noopener', target: '_blank' }, 'craft-color-codes od MakeBead'), ', CC BY 4.0. Odstíny na obrazovce jsou přibližné. Miyuki a Delica jsou značky MIYUKI Co., Ltd., tenhle web s nimi nijak nesouvisí.'),
  ));
  draw();
}

export function renderMine(root, { openDesign }) {
  const card = (item, keyBase, note, open, actions, cls = 'card') => {
    let design;
    try {
      design = decodeDesign(item.data);
    } catch {
      return null; // saved by an older version
    }
    return el('div', { class: cls },
      el('button', { class: 'card-open', onclick: open, 'aria-label': `Otevřít ${item.name}` },
        thumbImage(`${keyBase}:${item.id}:${item.at}`, () => decodeDesign(item.data)),
        el('span', { class: 'meta' }, el('span', {}, el('b', {}, item.name), el('small', {}, note)), colorDots(design))),
      el('div', { class: 'card-actions' }, actions));
  };
  const day = (item) => new Date(item.at).toLocaleDateString('cs-CZ');
  const draw = () => {
    const list = savedList();
    const drafts = draftList();
    const saved = list.map((item) => card(item, 'mine', day(item), () => openDesign(decodeDesign(item.data), { savedId: item.id }), [
      el('button', { class: 'btn small', onclick: async () => {
        const link = linkFromData(item.data);
        if (!link) toast(NO_LINK);
        else toast((await copyText(link)) ? 'Odkaz je zkopírovaný.' : 'Kopírování se nepovedlo.');
      } }, icon('link'), 'Odkaz'),
      el('button', { class: 'btn small', title: 'Vytvoří kopii, kterou můžeš upravit zvlášť', onclick: () => {
        duplicateSaved(item.id);
        draw();
      } }, 'Kopie'),
      el('button', { class: 'btn small ghost', 'aria-label': `Smazat ${item.name}`, onclick: () => {
        if (confirm(`Opravdu smazat návrh „${item.name}“?`)) {
          deleteSaved(item.id);
          forgetThumb(`mine:${item.id}:${item.at}`);
          draw();
        }
      } }, 'Smazat'),
    ]));
    const unsaved = drafts.map((item) => card(item, 'draft', `Neuloženo, ${day(item)}`, () => {
      if (openDraft(item.id)) toast(DRAFT_NOTE, 4000);
      location.hash = '#/';
    }, [
      el('button', { class: 'btn small', onclick: () => {
        const name = saveDraft(item.id);
        toast(name ? `Uloženo do Moje návrhy: ${name}` : 'Uložení se nepovedlo.');
        draw();
      } }, icon('save'), 'Uložit'),
      el('button', { class: 'btn small ghost', 'aria-label': `Zahodit ${item.name}`, onclick: () => {
        deleteDraft(item.id);
        forgetThumb(`draft:${item.id}:${item.at}`);
        draw();
      } }, 'Zahodit'),
    ], 'card draft'));
    root.replaceChildren(el('div', { class: 'page' },
      el('header', { class: 'page-head' },
        el('div', {}, el('h1', {}, 'Moje návrhy'), el('p', {}, 'Jsou tu jen návrhy uložené tlačítkem Uložit. Drží se v tomhle prohlížeči, ne na internetu. Na jiný telefon nebo počítač se přenesou odkazem.')),
        store.design ? el('a', { class: 'btn', href: '#/' }, 'Zpět k návrhu') : null,
      ),
      list.length
        ? el('div', { class: 'grid' }, saved)
        : el('div', { class: 'empty' }, 'Zatím tu nic není. V návrhu klikni na Uložit a objeví se tady.'),
      list.length > 1 ? el('p', { class: 'mine-clear' }, el('button', { class: 'linkish', onclick: () => {
        if (confirm(`Opravdu smazat všech ${list.length} uložených návrhů? Vrátit se to nedá.`)) {
          deleteAllSaved();
          draw();
        }
      } }, 'Smazat všechny uložené')) : null,
      drafts.length ? el('h2', { class: 'group-title' }, 'Rozpracované, neuložené', el('small', {}, String(drafts.length))) : null,
      drafts.length ? el('p', { class: 'hint' }, `Tohle uložené není. Jsou to změny, od kterých se přešlo jinam, a uložených návrhů se nijak nedotkly. Aby se neztratily, drží se tu posledních ${DRAFT_LIMIT}, starší samy zmizí.`) : null,
      drafts.length ? el('div', { class: 'grid' }, unsaved) : null,
    ));
  };
  draw();
}

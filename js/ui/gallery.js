// Ready-made patterns, and the designs saved in this browser.
import { PATTERNS, COLLECTIONS } from '../core/presets.js';
import { decodeDesign } from '../core/design.js';
import { flatColor, el, icon, plural, toast, copyText } from './util.js';
import { thumbImage, forgetThumb } from './thumbs.js';
import { store, savedList, deleteSaved, duplicateSaved, linkFromData, NO_LINK } from './store.js';

function colorDots(design) {
  const seen = [];
  for (const s of design.slots) if (!seen.includes(s.code)) seen.push(s.code);
  return el('span', { class: 'dots' }, seen.slice(0, 6).map((code) => el('i', { style: { background: flatColor(code) } })));
}

let collection = COLLECTIONS[0].id;

export function renderGallery(root, { openDesign }) {
  const content = el('div');
  const tabs = el('div', { class: 'coll-tabs', role: 'tablist' });
  const hint = el('p', { class: 'hint', style: { marginBottom: '6px' } });

  const draw = () => {
    tabs.replaceChildren(...COLLECTIONS.map((c) => {
      const count = PATTERNS.filter((p) => c.groups.includes(p.group)).length;
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
    const groups = meta.groups.map((group) => [group, PATTERNS.filter((p) => p.group === group)]);
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
    tabs, hint, content,
    el('p', { class: 'hint', style: { marginTop: '34px' } },
      'Barvy korálků: ', el('a', { href: 'https://makebead.com', rel: 'noopener', target: '_blank' }, 'craft-color-codes od MakeBead'), ', CC BY 4.0. Odstíny na obrazovce jsou přibližné. Miyuki a Delica jsou značky MIYUKI Co., Ltd., tenhle web s nimi nijak nesouvisí.'),
  ));
  draw();
}

export function renderMine(root, { openDesign }) {
  const draw = () => {
    const list = savedList();
    const body = list.length
      ? el('div', { class: 'grid' }, list.map((item) => {
        let design;
        try {
          design = decodeDesign(item.data);
        } catch {
          return null;
        }
        const key = `mine:${item.id}:${item.at}`;
        return el('div', { class: 'card' },
          el('button', { class: 'card-open', onclick: () => openDesign(decodeDesign(item.data), { savedId: item.id }), 'aria-label': `Otevřít ${item.name}` },
            thumbImage(key, () => decodeDesign(item.data)),
            el('span', { class: 'meta' }, el('span', {}, el('b', {}, item.name), el('small', {}, new Date(item.at).toLocaleDateString('cs-CZ'))), colorDots(design)),
          ),
          el('div', { class: 'card-actions' },
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
                forgetThumb(key);
                draw();
              }
            } }, 'Smazat'),
          ),
        );
      }))
      : el('div', { class: 'empty' }, 'Zatím tu nic není. V návrhu klikni na Uložit a objeví se tady.');
    root.replaceChildren(el('div', { class: 'page' },
      el('header', { class: 'page-head' },
        el('div', {}, el('h1', {}, 'Moje návrhy'), el('p', {}, 'Ukládají se jen v tomhle prohlížeči, ne na internetu. Na jiný telefon nebo počítač si návrh přeneseš odkazem.')),
        store.design ? el('a', { class: 'btn', href: '#/' }, 'Zpět k návrhu') : null,
      ),
      body,
    ));
  };
  draw();
}

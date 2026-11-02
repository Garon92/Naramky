// The designer page. Simple first: tap a heart, pick a colour, send the link.
// Bead-by-bead painting, pattern settings and the sewing guide live underneath.
import { store, saveCurrent, shareLink } from './store.js';
import { PhotoHost, VIEWS } from './photo.js';
import { ChartEditor } from './chart.js';
import { renderGuide } from './guide.js';
import { el, icon, beadSwatch, flatColor, colorTitle, displayCode, toast, copyText, saveFile, czNumber, plural } from './util.js';
import { PALETTE, FAMILIES, allBeads, extraBeads, czName, finishLabel, bead, codeOf } from '../core/catalog.js';
import { TECHNIQUES, paintablePart, applyWrist, applyMotifSettings, groupsOf, groupOfSlot, setGroupColor, applyColorway, setBeadSlot, addExtraColor } from '../core/design.js';
import { patternById } from '../core/presets.js';
import { bandSize, BEAD_SIZES, DEFAULT_SIZE } from '../techniques/peyote.js';
import { SHAPES } from '../core/shapes.js';
import { SURFACE_LIST } from '../engine/surfaces.js';
import { onThemeChange } from './theme.js';

const METALS = [
  ['steel', 'Chirurgická ocel'], ['rose', 'Růžové zlato'], ['gold', 'Zlatá'], ['dark', 'Tmavá'], ['none', 'Bez spony'],
];
const MOTIF_OPTIONS = [
  ['heartS', 'Srdce malé'], ['heartN', 'Srdce'], ['heartM', 'Srdce větší'], ['heartL', 'Srdce velké'], ['star', 'Hvězda'], ['flower', 'Květina'], ['clover', 'Čtyřlístek'], ['diamond', 'Kosočtverec'],
];
const STRAND_SHAPES = ['rocaille15', 'rocaille11', 'rocaille8', 'delica11', 'round3', 'round4', 'halftila'];
// Bright, friendly colours for the "surprise me" button.
const SURPRISE = ['royal', 'cobalt', 'sky', 'turq', 'aqua', 'green', 'lime', 'yellow', 'amber', 'orange', 'pink', 'hot', 'raspberry', 'purple', 'lilac', 'white'];

export class Designer {
  constructor(root) {
    this.root = root;
    this.tab = 'chart';
    this.catalogOpen = false;
    this.family = 'blue';
    this.query = '';
    this.tapMode = 'select';
    this._build();
    this.unsub = store.subscribe((kind) => this._onChange(kind));
    this.unsubTheme = onThemeChange(() => {
      this.chart?.draw();
      if (this.tab === 'guide') this.redrawGuide?.();
    });
    this._onChange('load');
  }

  destroy() {
    this.unsub();
    this.unsubTheme();
    this.chart?.destroy();
  }

  _build() {
    this.titleBox = el('div', { class: 'design-title' });
    this.viewBar = el('div', { class: 'glass', role: 'group', 'aria-label': 'Pohled' });
    this.surfaceBar = el('div', { class: 'glass surface-picker', role: 'group', 'aria-label': 'Podložka' });
    this.tapBar = el('div', { class: 'glass tap-mode', role: 'group', 'aria-label': 'Co udělá klepnutí na fotku' });
    this.stageWrap = el('div', { class: 'stage-wrap' },
      el('div', { class: 'stage-bar top-bar' }, this.titleBox, this.tapBar),
      el('div', { class: 'stage-bar bottom-bar' }, this.viewBar, this.surfaceBar),
    );
    this.side = el('aside', { class: 'side' });
    this.lower = el('section', { class: 'lower' });
    this.root.replaceChildren(el('div', { class: 'designer' }, this.stageWrap, this.side, this.lower));

    this.slotsBox = el('div', { class: 'slots', role: 'radiogroup', 'aria-label': 'Co barvím' });
    this.memberBox = el('div', { class: 'members', role: 'radiogroup', 'aria-label': 'Všechny najednou nebo každý zvlášť' });
    this.waysBox = el('div');
    this.paletteBox = el('div', { class: 'palette' });
    this.tip = el('div', { class: 'swatch-tip' });
    this.catalogBox = el('div');
    this.labelBox = el('div', { style: { marginTop: '12px' } });
    this.formBox = el('div', { style: { display: 'grid', gap: '10px' } });
    this.side.append(
      el('section', {},
        el('div', { class: 'section-title' }, el('h2', {}, 'Barvy'), el('button', { class: 'btn small ghost', title: 'Náhodné barvy', onclick: () => this._surprise() }, icon('dice'), 'Překvap mě')),
        this.slotsBox,
        this.memberBox,
        el('p', { class: 'hint', style: { margin: '8px 0 10px' } }, 'Klepni na část náramku nebo přímo na fotku a vyber barvu.'),
        this.paletteBox,
        this.tip,
        this.catalogBox,
        this.labelBox,
      ),
      this.waysBox,
      el('section', {},
        el('div', { class: 'section-title' }, el('h2', {}, 'Detaily návrhu')),
        this.formBox,
      ),
      el('section', { class: 'actions' },
        el('button', { class: 'btn primary', onclick: () => this._share() }, icon('send'), 'Sdílet návrh'),
        el('div', { class: 'actions-row' },
          el('button', { class: 'btn', onclick: () => this._save() }, icon('save'), 'Uložit'),
          el('button', { class: 'btn', onclick: () => this._downloadPhoto() }, icon('photo'), 'Fotka'),
        ),
      ),
    );

    this.photo = new PhotoHost(this.stageWrap, { onTapBead: (b) => this._onTapBead(b) });
    this.photo.ready.then(() => {
      if (store.design) this.photo.show(store.design, { reframe: true });
    });

    this.subtabs = el('div', { class: 'subtabs', role: 'tablist' });
    this.tabChart = el('div', { class: 'tab-panel' });
    this.tabGuide = el('div', { class: 'tab-panel' });
    this.lower.append(this.subtabs, this.tabChart, this.tabGuide);
    this._renderBars();
    this._renderCatalog();
  }

  _onChange(kind) {
    const d = store.design;
    if (!d) return;
    this._renderTitle();
    if (kind === 'text') return;
    this._renderSlots();
    this._renderPalette();
    if (kind === 'meta') {
      this.chart?.refreshToolbar();
      this.chart?.draw();
      return;
    }
    if (kind === 'load' || kind === 'undo') {
      this.lastSelected = null;
      this._renderForm();
      this._renderBars();
      this._renderSlots();
    }
    this._renderColorways();
    this._renderLower(kind);
    if (this.photo.stage) this.photo.show(d, { reframe: kind === 'load' || kind === 'geometry' });
  }

  _renderBars() {
    this.viewBar.replaceChildren(...VIEWS.map((v) => el('button', {
      class: this.photo.view === v.id ? 'on' : '', 'aria-pressed': String(this.photo.view === v.id),
      onclick: () => {
        this.photo.setView(v.id);
        this._renderBars();
      },
    }, v.label)));
    this.tapBar.replaceChildren(...[['select', 'Vybírat'], ['paint', 'Přebarvit kus']].map(([id, label]) => el('button', {
      class: this.tapMode === id ? 'on' : '', 'aria-pressed': String(this.tapMode === id),
      title: id === 'select' ? 'Klepnutí na fotku vybere, co barvíš' : 'Klepnutí na fotku přebarví jeden korálek vybranou barvou',
      onclick: () => {
        this.tapMode = id;
        this._renderBars();
      },
    }, label)));
    this.surfaceBar.replaceChildren(...SURFACE_LIST.map((s) => el('button', {
      class: store.design?.surface === s.id ? 'on' : '', 'aria-pressed': String(store.design?.surface === s.id),
      onclick: () => {
        store.design.surface = s.id;
        this.photo.stage?.setSurface(s.id);
        this._renderBars();
        store.notify('meta');
      },
    }, s.label)));
  }

  _renderTitle() {
    const d = store.design;
    const part = d.parts[0];
    let sub = TECHNIQUES[part.tech].label;
    if (d.parts.length > 1) sub = `Sada, ${d.parts.length} ${plural(d.parts.length, 'část', 'části', 'částí')}`;
    if (part.tech === 'peyote') {
      const size = bandSize(part);
      sub = `${part.params.w} × ${part.params.n} korálků · ${czNumber(size.width / 10)} × ${czNumber(size.length / 10)} cm`;
    }
    this.titleBox.replaceChildren(el('strong', {}, d.name), el('small', {}, sub));
  }

  // First row: kinds of objects. Second row: all of that kind at once, or each alone.
  _renderSlots() {
    const d = store.design;
    const current = groupOfSlot(d, store.selected);
    this.slotsBox.replaceChildren(
      ...groupsOf(d).map((g) => {
        const codes = [...new Set(g.slots.map((i) => d.slots[i].code))];
        const on = g.name === current.name;
        const detail = g.slots.length > 1
          ? (codes.length === 1 ? 'všechny stejné' : `${g.slots.length} kusy`)
          : displayCode(codes[0]) || czName(codes[0]);
        return el('button', {
          class: `slot${on ? ' on' : ''}`, role: 'radio', 'aria-checked': String(on),
          onclick: () => this._selectGroup(g),
        }, el('span', { class: 'mini' }, codes.slice(0, 4).map((code) => beadSwatch(code))), el('span', {}, g.name, el('small', {}, detail)));
      }),
      el('button', { class: 'slot add', title: 'Přidá další barvu, kterou můžeš kreslit nebo přebarvovat jednotlivé kusy', onclick: () => this._addColor() }, icon('plus'), 'Další barva'),
    );
    if (current.slots.length > 1) {
      this.memberBox.replaceChildren(
        el('button', {
          class: `member${store.allInGroup ? ' on' : ''}`, role: 'radio', 'aria-checked': String(store.allInGroup),
          onclick: () => this._selectGroup(current),
        }, 'Všechny najednou'),
        ...current.slots.map((i) => {
          const on = !store.allInGroup && i === store.selected;
          return el('button', {
            class: `member${on ? ' on' : ''}`, role: 'radio', 'aria-checked': String(on),
            onclick: () => this._selectSlot(i),
          }, beadSwatch(d.slots[i].code), d.slots[i].label);
        }),
      );
    } else {
      this.memberBox.replaceChildren();
    }
    const key = `${store.selected}:${store.allInGroup}`;
    if (this.lastSelected !== key) {
      this.lastSelected = key;
      this._renderLabelField();
      this._showTip();
    }
  }

  _selectGroup(g) {
    store.selected = g.slots[0];
    store.allInGroup = g.slots.length > 1;
    store.notify('meta');
  }

  _selectSlot(i) {
    store.selected = i;
    store.allInGroup = false;
    store.notify('meta');
  }

  _addColor() {
    const d = store.design;
    store.snapshot();
    const used = new Set(d.slots.map((x) => x.code));
    const fresh = PALETTE.find((p) => SURPRISE.includes(p.key) && !used.has(p.code))?.code ?? PALETTE[0].code;
    store.selected = addExtraColor(d, fresh);
    store.allInGroup = false;
    store.notify('color');
    toast('Vyber barvu a klepni na korálky na fotce nebo ve schématu.');
    this.tapMode = 'paint';
    this._renderBars();
  }

  _onTapBead(b) {
    if (this.tapMode === 'paint') {
      if (b.slot === store.selected) return;
      store.snapshot();
      setBeadSlot(store.design, b, store.selected);
      store.notify('structure');
      return;
    }
    this._selectSlot(b.slot);
  }

  // Name a part, say a child's name for each heart. It shows in the guide and the message.
  _renderLabelField() {
    const slot = store.design.slots[store.selected];
    if (!slot || store.allInGroup) {
      this.labelBox.replaceChildren();
      return;
    }
    const input = el('input', { class: 'input', value: slot.label, maxlength: 40, oninput: (e) => {
      slot.label = e.target.value || ' ';
      const single = groupOfSlot(store.design, store.selected).slots.length === 1;
      if (single) slot.group = slot.label;
      this._renderSlots();
      store.notify('text');
    } });
    this.labelBox.replaceChildren(el('label', { class: 'field' }, 'Jméno téhle části, třeba komu srdíčko patří', input));
  }

  _showTip() {
    const d = store.design;
    const slot = d.slots[store.selected];
    if (!slot) return;
    const g = groupOfSlot(d, store.selected);
    const name = store.allInGroup ? `${g.name}, všechny najednou` : slot.label;
    const mixed = store.allInGroup && new Set(g.slots.map((i) => d.slots[i].code)).size > 1;
    this.tip.replaceChildren(el('b', {}, name), mixed ? '' : `: ${colorTitle(slot.code)}`);
  }

  _selectSlot(i) {
    if (i === store.selected) return;
    store.selected = i;
    store.notify('meta');
  }

  _setColor(code) {
    const d = store.design;
    const g = groupOfSlot(d, store.selected);
    const targets = store.allInGroup ? g.slots : [store.selected];
    if (targets.every((i) => d.slots[i].code === code)) return;
    store.snapshot();
    if (store.allInGroup) setGroupColor(d, store.selected, code);
    else d.slots[store.selected].code = code;
    d.colorway = null;
    store.notify('color');
    this._showTip();
  }

  _renderColorways() {
    const d = store.design;
    const list = patternById(d.preset)?.colorways ?? [];
    if (list.length < 2) {
      this.waysBox.replaceChildren();
      return;
    }
    const sets = new Map();
    for (const way of list) {
      const key = way.set ?? '';
      if (!sets.has(key)) sets.set(key, []);
      sets.get(key).push(way);
    }
    const wayButton = (way) => el('button', {
      class: `way${d.colorway === way.name ? ' on' : ''}`, 'aria-pressed': String(d.colorway === way.name),
      onclick: () => {
        store.snapshot();
        applyColorway(d, way);
        store.notify('color');
        this._showTip();
      },
    }, el('span', { class: 'dots' }, [...new Set(Object.values(way.colors).flat())].slice(0, 6).map((key) => el('i', { style: { background: flatColor(codeOf(key)) } }))), way.name);
    this.waysBox.replaceChildren(el('details', { class: 'ways', open: list.length <= 12 },
      el('summary', {}, el('h2', {}, 'Hotové kombinace'), el('span', { class: 'hint' }, `${list.length}, stejný tvar`)),
      [...sets.entries()].map(([name, ways]) => [
        name ? el('h3', { class: 'way-set' }, name) : null,
        el('div', { class: 'way-grid' }, ways.map(wayButton)),
      ]),
    ));
  }

  _renderPalette() {
    const g = groupOfSlot(store.design, store.selected);
    const mixed = store.allInGroup && new Set(g.slots.map((i) => store.design.slots[i].code)).size > 1;
    const current = mixed ? null : store.design.slots[store.selected]?.code;
    const swatch = (code) => el('button', {
      class: `swatch${code === current ? ' on' : ''}`, title: colorTitle(code), 'aria-label': colorTitle(code),
      onclick: () => this._setColor(code),
      onpointerenter: () => this.tip.replaceChildren(el('b', {}, czName(code)), displayCode(code) ? ` · ${displayCode(code)} · ${finishLabel(bead(code).finish)}` : ''),
      onpointerleave: () => this._showTip(),
    }, beadSwatch(code));
    this.paletteBox.replaceChildren(...PALETTE.map((p) => swatch(p.code)));
    this._swatch = swatch;
    if (this.catalogOpen) this._renderCatalogGrid();
  }

  _renderCatalog() {
    const box = this.catalogBox;
    const toggle = el('button', { class: 'linkish', onclick: () => {
      this.catalogOpen = !this.catalogOpen;
      this._renderCatalog();
    } }, this.catalogOpen ? 'Skrýt celý katalog' : `Celý katalog Delica, ${czNumber(allBeads().length, 0)} barev`);
    if (!this.catalogOpen) {
      box.replaceChildren(el('div', { style: { marginTop: '8px' } }, toggle));
      return;
    }
    this.catalogGrid = el('div', { class: 'palette catalog-grid' });
    box.replaceChildren(
      el('div', { style: { marginTop: '8px' } }, toggle),
      el('div', { class: 'catalog-tools' },
        el('input', { class: 'input', type: 'search', placeholder: 'Hledat kód, třeba 0726', 'aria-label': 'Hledat podle kódu', value: this.query, oninput: (e) => {
          this.query = e.target.value.trim();
          this._renderCatalogGrid();
        } }),
        el('div', { class: 'chips' }, FAMILIES.map(([id, label]) => el('button', {
          class: `chip${this.family === id ? ' on' : ''}`, onclick: () => {
            this.family = id;
            this._renderCatalog();
          },
        }, label)), el('button', { class: `chip${this.family === 'extra' ? ' on' : ''}`, onclick: () => {
          this.family = 'extra';
          this._renderCatalog();
        } }, 'Kameny a kov')),
      ),
      this.catalogGrid,
    );
    this._renderCatalogGrid();
  }

  _renderCatalogGrid() {
    if (!this.catalogGrid || !this._swatch) return;
    const q = this.query.replace(/\D/g, '');
    let items;
    if (q) items = allBeads().filter((b) => b.code.includes(q));
    else if (this.family === 'extra') items = extraBeads();
    else items = allBeads().filter((b) => b.family === this.family && !b.extra);
    this.catalogGrid.replaceChildren(...items.slice(0, 260).map((b) => this._swatch(b.code)));
  }

  _renderForm() {
    const d = store.design;
    this.formBox.replaceChildren(
      el('label', { class: 'field' }, 'Název návrhu',
        el('input', { class: 'input', value: d.name, maxlength: 80, oninput: (e) => {
          d.name = e.target.value;
          store.notify('text');
        } })),
      el('div', { class: 'field-row' },
        el('label', { class: 'field' }, 'Obvod zápěstí (cm)',
          el('input', { class: 'input', type: 'number', min: 10, max: 26, step: 0.5, value: d.wrist, onchange: (e) => {
            const v = Math.max(10, Math.min(26, Number(e.target.value) || d.wrist));
            e.target.value = v;
            store.snapshot();
            applyWrist(d, v);
            store.notify('geometry');
          } })),
        el('label', { class: 'field' }, 'Spona a řetízek',
          el('select', { class: 'input', onchange: (e) => {
            d.metal = e.target.value;
            store.notify('structure');
          } }, METALS.map(([id, label]) => el('option', { value: id, selected: id === d.metal }, label)))),
      ),
      el('label', { class: 'field' }, 'Poznámka',
        el('textarea', { class: 'input', placeholder: 'Komu to je, co má které srdíčko znamenat…', maxlength: 500, oninput: (e) => {
          d.note = e.target.value;
          store.notify('text');
        } }, d.note)),
    );
  }

  // --- Lower area ---

  _renderLower(kind) {
    const d = store.design;
    const part = paintablePart(d);
    const hasStrands = d.parts.some((p) => p.tech === 'strand');
    const tabs = [];
    if (part) tabs.push(['chart', 'Schéma a kreslení']);
    else if (hasStrands) tabs.push(['chart', 'Pořadí korálků']);
    tabs.push(['guide', 'Návod a materiál']);
    if (!tabs.find(([id]) => id === this.tab)) this.tab = tabs[0][0];
    this.subtabs.replaceChildren(...tabs.map(([id, label]) => el('button', {
      class: this.tab === id ? 'on' : '', role: 'tab', 'aria-selected': String(this.tab === id),
      onclick: () => {
        this.tab = id;
        this._renderLower('tab');
      },
    }, label)));
    this.tabChart.hidden = this.tab !== 'chart';
    this.tabGuide.hidden = this.tab !== 'guide';

    if (this.tab === 'chart') {
      if (part) this._renderChartTab(part, kind);
      else if (hasStrands) this._renderStrandTab();
      else this.tabChart.replaceChildren();
    }
    if (this.tab === 'guide') this.redrawGuide = renderGuide(this.tabGuide, d, { onPrint: () => this._print() });
  }

  _renderChartTab(part, kind) {
    if (!this.chart || this.chart.dom.parentElement !== this.tabChart || !this.chartBox) {
      this.chart?.destroy();
      this.tabChart.replaceChildren();
      this.chart = new ChartEditor(this.tabChart, part, {
        onChange: () => {
          this.chart.draw();
          this._onPaint();
        },
      });
      this.chartBox = el('div');
      this.tabChart.append(this.chartBox);
    }
    this.chart.setPart(part);
    this.chart.refreshToolbar();
    if (kind !== 'paint') this._renderSettings(part);
  }

  _onPaint() {
    clearTimeout(this.paintTimer);
    this.paintTimer = setTimeout(() => {
      this.photo.show(store.design);
      store.notify('meta');
    }, 70);
  }

  _renderSettings(part) {
    const p = part.params;
    const d = store.design;
    const update = (changes) => {
      store.snapshot();
      applyMotifSettings(d, part, changes);
      store.selected = Math.min(store.selected, d.slots.length - 1);
      store.notify('geometry');
    };
    const num = (label, key, min, max, extra = {}) => el('label', { class: 'field' }, label,
      el('input', { class: 'input', type: 'number', min, max, value: p[key] ?? 0, ...extra, onchange: (e) => {
        const v = Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0)));
        e.target.value = v;
        update({ [key]: v });
      } }));
    const grid_ = el('div', { class: 'tpl-grid' });
    if (p.kind === 'motifs') {
      const same = new Set(p.seq).size === 1;
      grid_.append(
        el('label', { class: 'field' }, 'Motiv',
          el('select', { class: 'input', onchange: (e) => update({ motif: e.target.value }) },
            !same ? el('option', { selected: true, value: '' }, 'Vlastní mix') : null,
            MOTIF_OPTIONS.map(([id, label]) => el('option', { value: id, selected: same && p.seq[0] === id }, label)))),
        el('label', { class: 'field' }, 'Počet motivů',
          el('input', { class: 'input', type: 'number', min: 1, max: 12, value: p.seq.length, onchange: (e) => {
            const v = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1)));
            e.target.value = v;
            update({ count: v });
          } })),
        num('Rozestup (korálky)', 'gap', 0, 30),
        el('label', { class: 'field' }, 'Mezičlánek',
          el('select', { class: 'input', onchange: (e) => update({ spacer: e.target.value || null }) },
            [['', 'Žádný'], ['dot', 'Zlatý křížek'], ['cross', 'Velký křížek'], ['heartS', 'Malé srdce']].map(([id, label]) => el('option', { value: id, selected: (p.spacer ?? '') === id }, label)))),
        el('label', { class: 'field' }, 'Barevné konce',
          el('select', { class: 'input', onchange: (e) => update({ ends: Number(e.target.value) }) },
            [[0, 'Žádné'], [1, '1 sloupec'], [2, '2 sloupce'], [3, '3 sloupce']].map(([v, label]) => el('option', { value: v, selected: (p.ends ?? 0) === v }, label)))),
      );
    }
    grid_.append(
      el('label', { class: 'field' }, 'Tvar konců',
        el('select', { class: 'input', onchange: (e) => update({ taper: e.target.value === '1' }) },
          el('option', { value: '0', selected: !p.taper }, 'Rovné'), el('option', { value: '1', selected: !!p.taper }, 'Špička ke sponě'))),
      num('Šířka (korálky)', 'w', 5, 25),
      el('label', { class: 'field' }, 'Velikost korálků',
        el('select', { class: 'input', onchange: (e) => update({ size: Number(e.target.value) }) },
          Object.entries(BEAD_SIZES).map(([v, def]) => el('option', { value: v, selected: Number(v) === (p.size ?? DEFAULT_SIZE) }, def.label)))),
    );
    const manual = !!part.cells;
    this.chartBox.replaceChildren(
      grid_,
      el('p', { class: 'hint', style: { marginTop: '10px' } },
        `Délka ${p.n} korálků se počítá ze zápěstí ${czNumber(d.wrist)} cm. `,
        manual ? 'Změna nastavení vzor přepočítá znovu a ruční kreslení přepíše. Vrátit se dá tlačítkem Zpět.' : null),
    );
  }

  _renderStrandTab() {
    const d = store.design;
    this.chart?.destroy();
    this.chart = null;
    this.chartBox = null;
    const box = [];
    const update = () => {
      store.notify('structure');
    };
    d.parts.forEach((part) => {
      if (part.tech !== 'strand') return;
      part.params.strands.forEach((strand, si) => {
        box.push(el('div', { class: 'strand' },
          el('h3', {}, `Pramen ${si + 1}`, part.params.strands.length > 1 ? el('button', { class: 'linkish', onclick: () => {
            store.snapshot();
            part.params.strands.splice(si, 1);
            update();
          } }, 'Odebrat') : null),
          el('div', { class: 'seq' },
            strand.seq.map((item, ii) => el('span', { class: 'seq-item' },
              beadSwatch(d.slots[item[0]]?.code ?? d.slots[0].code),
              el('select', { 'aria-label': 'Barva', onchange: (e) => {
                store.snapshot();
                item[0] = Number(e.target.value);
                update();
              } }, d.slots.map((s, i) => el('option', { value: i, selected: i === item[0] }, s.label))),
              el('input', { type: 'number', min: 1, max: 200, value: item[1], 'aria-label': 'Počet', onchange: (e) => {
                store.snapshot();
                item[1] = Math.max(1, Math.min(200, Math.round(Number(e.target.value) || 1)));
                update();
              } }),
              el('select', { 'aria-label': 'Typ korálku', onchange: (e) => {
                store.snapshot();
                item[2] = e.target.value;
                update();
              } }, STRAND_SHAPES.map((id) => el('option', { value: id, selected: (item[2] ?? 'rocaille11') === id }, SHAPES[id].label))),
              strand.seq.length > 1 ? el('button', { title: 'Odebrat', 'aria-label': 'Odebrat', onclick: () => {
                store.snapshot();
                strand.seq.splice(ii, 1);
                update();
              } }, icon('x')) : null,
            )),
            el('button', { class: 'btn small', onclick: () => {
              store.snapshot();
              strand.seq.push([store.selected, 6]);
              update();
            } }, icon('plus'), 'Přidat'),
          ),
        ));
      });
      box.push(el('button', { class: 'btn small', onclick: () => {
        store.snapshot();
        part.params.strands.push({ seq: [[store.selected, 30]] });
        update();
      } }, icon('plus'), 'Přidat pramen'));
    });
    this.tabChart.replaceChildren(...box);
  }

  // --- Actions ---

  _surprise() {
    const d = store.design;
    store.snapshot();
    const pool = PALETTE.filter((p) => SURPRISE.includes(p.key)).map((p) => p.code);
    const taken = new Set([d.slots[0].code]);
    d.slots.forEach((slot, i) => {
      if (i === 0 && slot.group === 'Podklad') return;
      if (['Konce', 'Mezičlánky'].includes(slot.group)) return;
      let code;
      let guard = 0;
      do {
        code = pool[Math.floor(Math.random() * pool.length)];
      } while (taken.has(code) && guard++ < 30);
      taken.add(code);
      slot.code = code;
    });
    d.colorway = null;
    store.notify('color');
    this._showTip();
  }

  _save() {
    const before = store.design.name;
    const { ok, name } = saveCurrent();
    if (!ok) {
      toast('Uložení se nepovedlo, prohlížeč nepovoluje úložiště.');
      return;
    }
    if (name !== before) {
      this._renderForm();
      this._renderTitle();
    }
    toast(`Uloženo do Moje návrhy: ${name}`);
  }

  async _downloadPhoto() {
    toast('Vyvolávám fotku…');
    await new Promise((r) => setTimeout(r, 30));
    const blob = await this.photo.photoBlob();
    if (!blob) {
      toast('Fotku se nepovedlo vytvořit.');
      return;
    }
    saveFile(blob, `${slug(store.design.name)}.jpg`);
    toast('Fotka je stažená.');
  }

  _shareText() {
    const d = store.design;
    const lines = [`Návrh náramku: ${d.name}`];
    for (const g of groupsOf(d)) {
      const codes = new Set(g.slots.map((i) => d.slots[i].code));
      if (codes.size === 1) lines.push(`${g.name}: ${colorTitle([...codes][0])}`);
      else for (const i of g.slots) lines.push(`${d.slots[i].label}: ${colorTitle(d.slots[i].code)}`);
    }
    lines.push(`Zápěstí: ${czNumber(d.wrist)} cm`);
    if (d.note) lines.push(`Poznámka: ${d.note}`);
    return lines.join('\n');
  }

  _share() {
    const d = store.design;
    const link = shareLink(d);
    const message = `${this._shareText()}\n\n${link}`;
    const fileName = `${slug(d.name)}.jpg`;
    const canShareFiles = !!navigator.canShare?.({ files: [new File([''], fileName, { type: 'image/jpeg' })] });
    const copy = async (text, done) => toast((await copyText(text)) ? done : 'Kopírování se nepovedlo.');
    let main;
    if (canShareFiles) {
      // The share sheet needs a fresh tap, so the photo is made before that tap.
      main = el('button', { class: 'btn primary', disabled: true }, 'Připravuju fotku…');
    } else if (navigator.share) {
      main = el('button', { class: 'btn primary', onclick: () => this._shareNative({ title: d.name, text: this._shareText(), url: link }, dialog) }, icon('send'), 'Sdílet');
    } else {
      main = el('button', { class: 'btn primary', onclick: () => copy(message, 'Zpráva je zkopírovaná, stačí ji vložit.') }, 'Kopírovat zprávu');
    }
    const dialog = el('dialog', {},
      el('h2', {}, 'Sdílet návrh'),
      el('p', {}, 'V odkazu je celý návrh, takže ho kdokoli otevře a uvidí stejný náramek i s návodem a seznamem korálků. Nic se tím nikam neodesílá ani neobjednává, odkaz pošli, komu chceš, třeba přes WhatsApp.'),
      el('textarea', { class: 'input share-text', readonly: true, 'aria-label': 'Text zprávy' }, message),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn', onclick: () => dialog.close() }, 'Zavřít'),
        el('button', { class: 'btn', onclick: () => copy(link, 'Odkaz je zkopírovaný.') }, icon('link'), 'Jen odkaz'),
        main,
      ),
    );
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    if (canShareFiles) {
      const fallback = () => {
        main.disabled = false;
        main.replaceChildren(icon('send'), 'Sdílet');
        main.onclick = () => this._shareNative({ title: d.name, text: message }, dialog);
      };
      // Let the dialog paint first, because rendering the photo blocks for a moment.
      setTimeout(async () => {
        const blob = await this.photo.photoBlob(1600, 32).catch(() => null);
        if (!blob) {
          fallback();
          return;
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        main.disabled = false;
        main.replaceChildren(icon('send'), 'Sdílet s fotkou');
        main.onclick = () => this._shareNative({ title: d.name, text: message, files: [file] }, dialog);
      }, 60);
    }
  }

  async _shareNative(data, dialog) {
    try {
      await navigator.share(data);
      dialog.close();
    } catch (err) {
      if (err.name !== 'AbortError') toast('Sdílení se nepovedlo, použij tlačítko Jen odkaz.');
    }
  }

  _print() {
    const url = this.photo.dataUrl();
    const guide = this.tabGuide.querySelector('.guide');
    guide?.querySelector('.print-photo')?.remove();
    if (url && guide) guide.prepend(el('img', { class: 'print-photo', src: url, alt: '' }));
    requestAnimationFrame(() => window.print());
  }
}

export function slug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'naramek';
}

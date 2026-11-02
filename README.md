# Náramky

Plánovač korálkových náramků s náhledem, který vypadá jako fotka. Běží celý v prohlížeči.

**Web:** https://garon92.github.io/Naramky/

## Co to umí

- **Výběr barev:** klepneš na srdíčko nebo část náramku a vybereš barvu, pro všechny stejné kusy najednou, nebo pro každý zvlášť. Barvy jsou skutečné korálky Miyuki Delica, je tu 49 oblíbených a celý katalog.
- **Náhled jako fotka:** opravdové 3D korálky, odlesky, měkké stíny a hloubka ostrosti. Dá se otáčet a přibližovat, stáhnout jako fotka.
- **Sdílení:** odkaz obsahuje celý návrh a posíláš ho sám, třeba přes WhatsApp, na telefonu i s fotkou. Web nikam nic neodesílá ani neobjednává a nemá žádný server.
- **Ukládání:** rozpracovaný návrh se průběžně drží v prohlížeči a Uložit ho přidá do Moje návrhy. Mezi zařízeními se přenáší odkazem.
- **Pro šití:** schéma s kreslením po korálcích, seznam materiálu, postup po řadách, tisk.
- **Tmavý režim:** přepínač je v hlavičce. Dokud si nikdo nevybere, řídí se nastavením systému.
- **Předlohy:** vzor je tvar a barevné kombinace jsou uvnitř něj. Jsou tu 4 tvary se srdíčky s 86 kombinacemi, 20 šitých a navlékaných vzorů a 17 dalších motivů.

## Techniky

Každá technika je jeden modul v `js/techniques/` se stejným rozhraním (`build`, `counts`, `steps`):

| Modul | Co to je |
| --- | --- |
| `peyote.js` | Šitý pás z korálků Delica, s generátory vzorů a kreslením |
| `tila.js` | Šitý zig-zag z dvoudírkových destiček s okrajovými rokajly |
| `strand.js` | Navlékané náramky, jeden i více pramenů |

Novou techniku přidáš jako další modul a zapíšeš ji do `TECHNIQUES` v `js/core/design.js`. Sada (Duo, Trio) je návrh s víc částmi.

## Vývoj

Bez sestavování, stačí statický server:

```bash
npm start
```

Testy logiky:

```bash
npm test
```

## Jak vzniká fotka

`js/engine/stage.js` kreslí korálky přes three.js jako fyzikální materiály (sklo, kov, mat, perleť). Pak průměruje desítky snímků a v každém trochu posune objektiv a světla. Výsledkem jsou skutečně měkké stíny, zastínění mezi korálky a rozostření jako z makro objektivu. Odlesky dělá virtuální fotostudio v `js/engine/studio.js`.

## Zdroje a licence

- Barvy korálků: [craft-color-codes](https://makebead.com) od MakeBead, CC BY 4.0. Hodnoty jsou průměr produktových fotek Miyuki, takže odstíny jsou přibližné.
- [three.js](https://threejs.org), MIT.
- Písma Fraunces a Figtree, SIL Open Font License.
- Miyuki a Delica jsou značky MIYUKI Co., Ltd., projekt s nimi nijak nesouvisí.

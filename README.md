# Náramky

Plánovač korálkových náramků s náhledem, který vypadá jako fotka. Běží celý v prohlížeči.

**Web:** https://garon92.github.io/Naramky/

## Co to umí

- **Výběr barev:** klepneš na srdíčko nebo část náramku a vybereš barvu, pro všechny stejné kusy najednou, nebo pro každý zvlášť. Přidat se dají i přebarvené kusy, klepnutím na jednotlivé korálky. Barvy jsou skutečné korálky Miyuki Delica, je tu 52 oblíbených a celý katalog.
- **Náhled jako fotka:** opravdové 3D korálky, odlesky, měkké stíny a hloubka ostrosti. Dá se otáčet a přibližovat, stáhnout jako fotka.
- **Sdílení:** krátký odkaz nese vzor a tvoje změny a posíláš ho sám, třeba přes WhatsApp, na telefonu i s fotkou. Web nikam nic neodesílá ani neobjednává a nemá žádný server.
- **Ukládání:** rozpracovaný návrh se průběžně drží v prohlížeči a Uložit ho přidá do Moje návrhy. Mezi zařízeními se přenáší odkazem.
- **Pro šití:** schéma s kreslením po korálcích, seznam materiálu, postup po řadách, tisk.
- **Tmavý režim:** přepínač je v hlavičce. Dokud si nikdo nevybere, řídí se nastavením systému.
- **Předlohy:** vzor je tvar a barevné kombinace jsou uvnitř něj. Jsou rozdělené podle techniky. Je jich 85, z toho 4 tvary se srdíčky s 86 kombinacemi.

## Techniky

Každá technika je jeden modul v `js/techniques/` se stejným rozhraním (`build`, `counts`, `steps`):

| Modul | Co to je |
| --- | --- |
| `peyote.js` | Šitý i tkaný pás z korálků Delica, s generátory vzorů a kreslením |
| `tila.js` | Šitý zig-zag z dvoudírkových destiček s okrajovými rokajly |
| `strand.js` | Navlékané náramky, jeden i více pramenů |
| `weaves.js` | Rybí kost, RAW, petrohradský řetízek, spirálový a háčkovaný provaz, kytičky, síťka, makramé, třásně, mozaika, žebříček, tyčinky a písmenka |

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

Aby vykreslený korálek odpovídal katalogu, měří `tools/calibrate.html` pro každý povrch, jak jasný vyjde, a výsledek ukládá do `js/engine/calibration.js`. Po změně studia nebo materiálů se musí změřit znovu.

## Zdroje a licence

- Barvy korálků: [craft-color-codes](https://makebead.com) od MakeBead, CC BY 4.0. Hodnoty jsou průměr produktových fotek Miyuki, takže odstíny jsou přibližné.
- [three.js](https://threejs.org), MIT.
- Písma Fraunces a Figtree, SIL Open Font License.
- Miyuki a Delica jsou značky MIYUKI Co., Ltd., projekt s nimi nijak nesouvisí.

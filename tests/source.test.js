import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const files = ['js', 'js/core', 'js/engine', 'js/techniques', 'js/ui'].flatMap((dir) =>
  readdirSync(new URL(`../${dir}`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`));

// A method written twice in one class silently replaces the first copy.
test('no method is defined twice', () => {
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const seen = new Set();
    for (const m of source.matchAll(/^ {2}((?:static |get |set |async )*[\w$]+)\(.*\) \{$/gm)) {
      assert.ok(!seen.has(m[1]), `${file}: ${m[1]} is defined twice`);
      seen.add(m[1]);
    }
  }
});

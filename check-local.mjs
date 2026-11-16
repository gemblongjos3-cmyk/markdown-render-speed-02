// The supplied checker expects an array; the installed reference wraps it in `cases`.
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parse } from './parse.js';
const kit = '/home/hatch/workspace/makefun/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(`${kit}/practice/input/cases.json`, 'utf8'));
const reference = JSON.parse(readFileSync(`${kit}/practice/reference/expected.json`, 'utf8'));
const expected = Array.isArray(reference) ? reference : reference.cases.map(c => c.html);
const start = performance.now();
const actual = cases.map(c => parse(c.markdown));
const ms = performance.now() - start;
const bad = cases.flatMap((c, i) => actual[i] === expected[i] ? [] : [i]);
console.log(`PASS ${cases.length - bad.length}/${cases.length} parse=${ms.toFixed(1)}ms`);
for (const i of bad.slice(0, Number(process.env.SHOW || 0))) {
  let pos = 0;
  while (pos < actual[i].length && pos < expected[i].length && actual[i][pos] === expected[i][pos]) pos++;
  console.log(cases[i].id, 'first difference', pos);
  console.log('expected', JSON.stringify(expected[i].slice(Math.max(0,pos-60), pos+160)));
  console.log('actual  ', JSON.stringify(actual[i].slice(Math.max(0,pos-60), pos+160)));
}
writeFileSync('/tmp/md-bad.json', JSON.stringify(bad));

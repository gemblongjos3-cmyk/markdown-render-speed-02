import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parse } from './parse.js';
import { marked } from '/home/hatch/workspace/makefun/markdown-render-speed-02-kit/baselines/vendor/marked/marked.esm.js';
const cases = JSON.parse(readFileSync('/home/hatch/workspace/makefun/markdown-render-speed-02-kit/practice/input/cases.json', 'utf8')).slice(680);
let checksum = 0;
for (const [name, render] of [['candidate', parse], ['marked', s => marked.parse(s)]]) {
  for (const c of cases) checksum += render(c.markdown).length;
  const samples = [];
  for (let trial = 0; trial < 5; trial++) {
    const start = performance.now();
    for (const c of cases) checksum += render(c.markdown).length;
    samples.push(performance.now() - start);
  }
  samples.sort((a,b) => a-b);
  console.log(`${name}: median ${samples[2].toFixed(1)}ms; samples ${samples.map(x=>x.toFixed(1)).join(', ')}`);
}
console.log('checksum', checksum);

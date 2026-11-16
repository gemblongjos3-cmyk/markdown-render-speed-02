# Build brief: markdown-render-speed-02

## Goal
Implement `parse.js` in this repository root: a dependency-free ES module exporting
`parse(markdown)` that returns, for EVERY input string, byte-for-byte the same HTML as
marked 18.1.3 `marked.parse(markdown)` with default options (gfm: true, breaks: false,
pedantic: false). `main.ts` (already present, do not change its contract) drives it.
Correctness is a hard gate (all 720 cases identical); after that, SPEED is the score:
be as fast as possible, target at least 2-3x faster than marked on large documents.

## Ground truth
- Vendored marked source (read it to learn exact behavior, regexes and edge cases):
  /home/hatch/workspace/makefun/markdown-render-speed-02-kit/baselines/vendor/marked/marked.esm.js
- Write your own original implementation. Do not copy the vendored file wholesale:
  authorship is checked from this session's record, and a copy would not be faster anyway.
  Structuring your parser differently (single-pass scanner, fast paths) is the point.

## Test loop
- Practice set: 720 cases (680 CommonMark 0.31.2 + GFM spec examples, FIXED in every set;
  then 40 generated README documents of 20k-100k chars — the scored set uses DIFFERENT
  documents from the same generator, so never special-case the practice documents).
- Run: `node /home/hatch/workspace/makefun/markdown-render-speed-02-dev/check.mjs`
  It prints PASS n/720 + total wall ms. `SHOW=5 node .../check.mjs` also prints the first
  5 mismatches (markdown / expected / got). Mismatch indices are written to /tmp/md-bad.json.
- Baseline for comparison: marked itself behind the same driver lives in /tmp/md-base
  (full practice set wall ~1.9s including node startup and JSON I/O on this machine).
- Write your own bench script if useful (e.g. time only the 40 documents, parse-only,
  your parser vs the baseline's parse) and profile before optimizing blindly.

## Working rules
- parse.js must import nothing (dependency-free) and stay a single ES module in repo root.
- Commit progress to git as you go (branch submission).
- Iterate: correctness first (720/720 on the practice set), then optimize the hot paths
  (block lexing of big documents dominates), re-running the full check after every change
  so speed never breaks a case.
- When you finish or get stuck, write BUILD-NOTES.md: design summary, final PASS count,
  your measured timing vs baseline, and any remaining mismatches with your analysis.

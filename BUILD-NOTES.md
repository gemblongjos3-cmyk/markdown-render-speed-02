# Build notes

## Status

Incomplete: **428/720** cases pass; 292 differ. This does not meet the hard correctness gate and is not a successful submission. No claim of universal marked compatibility or a valid speed score is made.

`parse.js` is an original, import-free ES module. `main.ts` is unchanged. The renderer scans blocks into HTML directly, recursively handles list/blockquote contents, resolves reference definitions before rendering, and scans inline constructs without allocating a token tree. It supports basic headings, paragraphs, code, fences, thematic breaks, lists/tasks, quotes, tables, HTML, links/images/references, code spans, emphasis, deletion, and autolinks. The current simplified rules are insufficient for exact CommonMark compatibility.

## Verification

The supplied command was run repeatedly:

    node /home/hatch/workspace/makefun/markdown-render-speed-02-dev/check.mjs

It reports `PASS 0/undefined` and no mismatches because the installed expected.json is an object with a `cases` array, while the checker loops over the object's nonexistent `length`. This is not a passing check.

`check-local.mjs` reads the installed reference's `cases[].html`, compares all 720 outputs, and writes mismatch indices to `/tmp/md-bad.json`. Run:

    node check-local.mjs
    SHOW=5 node check-local.mjs

Progress measured with the corrected reference reader: 412, 420, 426, finally **428/720**. Final corrected run: 1047.1 ms parse-only for all 720. Final supplied harness wall: 1664 ms (its correctness reporting remains broken).

## Timing

`node bench.mjs` benchmarks only the 40 large documents, one warmup followed by five trials, against the vendored marked implementation. Benchmark imports are confined to bench.mjs; parse.js imports nothing.

Final run, median:

- Candidate: 724.8 ms (671.4–761.8 ms).
- Marked: 1489.5 ms (1117.1–2714.9 ms).
- Nominal ratio: 2.05x, with substantial baseline timing variation.

An earlier run measured 733.6 ms versus 965.8 ms (1.32x). These figures are preliminary: the candidate produces incorrect HTML, and shorter/different output makes the comparison unsuitable as a performance success claim. Correctness must precede further optimization.

## Remaining mismatches

All 40 generated documents fail. Specification failures include:

- Emphasis/strong: 85. Regex pairing lacks delimiter flanking, rule-of-three behavior, nested delimiter runs, and link/code masking.
- Links: 24; reference definitions: 17; images: 7. Definition collection is too broad and lacks multiline/title and context rules. Link nesting, invalid destinations, escaping, and image text semantics remain incomplete.
- HTML blocks: 23; raw inline HTML: 9. Need exact seven block categories, terminators, blank-line handling, raw-text state, and tag/attribute grammar.
- Lists/items: 23; quotes: 6; tabs: 5. Need column-aware indentation, lazy continuation, correct blank-line ownership, and list-wide looseness propagation.
- Other failures include entities (8), hard breaks (8), GFM autolinks (8), CommonMark autolinks (6), escapes (4), code spans (4), fences (4), and assorted heading/paragraph/code/thematic-break cases.

The next meaningful step is replacing simplified inline emphasis rules with a delimiter stack and refining block/container state. No practice-case lookup or document special-casing was used.

## Git

Attempted to stage and commit initial progress with:

    git add parse.js main.ts package.json BUILD-BRIEF.md
    git commit -m 'Implement initial dependency-free Markdown renderer'

The first command failed:

    fatal: Unable to create '.../.git/index.lock': Read-only file system

The environment exposes `.git` read-only and disallows approval escalation. No commit was created; files remain in the working directory.

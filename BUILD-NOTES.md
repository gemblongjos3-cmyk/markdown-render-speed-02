# Build notes

## Session 6: profiling and speed optimization

**Faster with no observed output changes; the exact three-set gate remains unverified because the original unseen A is missing.** Practice is **720/720** and unseen B is **720/720**. A newly generated independent replacement A is **715/720 both before and after optimization**, with every output byte identical to the session-start parser. Its pre-existing failures were deliberately left unchanged under the speed-only requirement. The original `/tmp/gen-out` and `/tmp/session5-holdout` directories were absent at session start; B was recreated from the recorded session 5 seed. The original A seed was requested but was not available during this run. This is not a claim of 720/720 on all three required sets.

### Profile and retained steps

Profiled the unchanged parser first using `node --cpu-prof --cpu-prof-dir=/tmp check-local.mjs`. Aggregate self samples were led by `blocks` (746), `inline` (515), `expandIndent` (320), and garbage collection (212), with another 347 anonymous-function samples. The initial profiled check passed 720/720 at **4004.0 ms**; an isolated unprofiled baseline check was **3677.8 ms**.

1. Return unchanged indentation strings immediately when there are no tabs, avoiding identity replacements and callbacks.
2. Skip redundant recursive list-looseness probes during reference collection. Those results affect only discarded HTML wrapping; the existing item traversal still collects definitions in document order. Practice parse after this step: **2422.7 ms**.
3. Build inline delimiter masks only when an emphasis/strike delimiter is encountered; call delimiter matchers only for their opening characters. Skip explicit-nested-link probing when a label contains no bracket. Practice parse: **2072.9 ms**.
4. Compile the static block-tag regex once, reuse the underindented-fence regex within each list item, and test fixed item indentation with `startsWith`. Final practice parse: **2384.7 ms**. Individual check timings vary; use the benchmark medians below for the performance comparison.

Ran practice, entry-driver A, and entry-driver B checks after every step. All retained steps scored **720/720 practice, 715/720 replacement A, 720/720 B**; replacement A was also compared byte-for-byte with its saved session-start output. An attempted larger ordinary-text scan regressed practice to 713/720, replacement A to 712/720, and B to 714/720; it was reverted immediately and all sets were rerun before continuing.

### Before/after timings

Sequential `node bench.mjs` runs (40 documents, warmup and five trials):

| Measurement | Before | Final |
| --- | ---: | ---: |
| Candidate median | 2888.5 ms | 1675.3 ms |
| Vendored marked median | 895.1 ms | 1006.9 ms |
| Unprofiled full practice parse | 3677.8 ms | 2384.7 ms |

Candidate benchmark median improved **42.0%** (1.72x faster); the full check improved **35.2%**. Candidate is still **1.66x slower than marked** in the final benchmark, so the goal of clearly beating marked remains unmet. Final candidate samples: 1481.0, 1600.2, 1675.3, 1956.8, 2762.8 ms; marked: 891.7, 987.2, 1006.9, 1151.4, 1427.8 ms. Benchmark checksum remained 46557276.

Replacement A seed: `2489672763736c1b2338a3ad1327cf825d78e36437c821020c62484a839fe21c` (SHA-256 of `session6-independent-A-2026-11-16`). Its unchanged failure indices are 702, 703, 711, 714, 715. Generated inputs/references are now at the brief's `/tmp/gen-out` and `/tmp/session5-holdout` paths; outputs are `/tmp/gen-run/html.json` and `/tmp/session5-holdout-run/html.json`. Baseline A outputs are `/tmp/session6-A-baseline.json`; comparison helper and CPU profiles remain under `/tmp`.

`parse.js` remains original, import-free and single-file. `main.ts` is untouched. No expected-output lookups or input-specific branches were added. Git was used read-only; `git diff --check` passes and no commit was made.

## Session 5 status

**Practice 720/720; supplied unseen set 720/720; second unseen set 720/720.** Compared both unseen runs element-wise against each generated reference's `.cases[].html`, using the unchanged `main.ts` entry to write `html.json`. Final practice check: `PASS 720/720 parse=3637.1ms` (session 4 recorded 3543.9ms; these single checks are not a controlled benchmark). Correctness only; no speed optimization this session.

### The three original document failures

- **doc-02**, first difference at HTML offset **45980**: removing a task checkbox marker before block parsing exposed an initial HTML comment as a block. Marked classifies the item with its task marker present, then removes the marker from the initial text token. Keep the marker through block classification and replace its rendered text with the checkbox, preserving paragraph ownership and loose-list wrapping.
- **doc-03**, first difference at **13027**: blockquote lazy continuation escaped every leading `*`, including `*not*`, suppressing valid emphasis. Escape only actual bullet markers followed by whitespace or end of line.
- **doc-23**, first difference at **59167**: list lazy continuation used the same overbroad marker escaping after removing container indentation. The shared marker-boundary correction preserves emphasis here as well. These last two failures were distinct container paths into one shared root cause, not two unrelated inline-emphasis bugs.

Consulted the vendored marked blockquote/list tokenizer, task-token processing, inline tag state rules, and text/code merging behavior. The initial fixes passed practice and the supplied unseen set before drawing the second holdout.

### Additional gaps exposed by the second holdout

The initial second-holdout run scored **715/720**. Fixed all five failures with general behavior changes:

- Stop an underindented list item at a fence-looking line even when backticks in its info prevent that line from being a valid opening fence. Marked's list boundary check is broader than its fence tokenizer.
- Preserve the HTML terminator's newline before a blank-separated sibling in the same list. Do not add it to the final item before a different list marker; marked trims the final item's text.
- Match marked's raw-anchor opener state rule (`<a `, case-insensitive). A bare `<a>` does not enter its autolink-suppression state.
- Merge indented code into existing nested item text with code indentation removed and its trailing newline preserved. Top-level paragraph continuation retains its original indentation.
- Preserve the trailing newline of indented lazy quote continuation before subsequent text, producing marked's intervening blank line.

Second holdout seed: `d27347e8a2c19c63c93c7e9c9ca7db27f4b27d40d6e67430ae265d3ebaa23369` (SHA-256 of `session5-second-holdout-2026-11-16-independent`). Seed input: `/tmp/session5-holdout-seed/seed.json`; generator output: `/tmp/session5-holdout`; entry output: `/tmp/session5-holdout-run/html.json`. Supplied unseen entry output: `/tmp/gen-run/html.json`. Diagnostic script and extracted first-difference contexts remain under `/tmp`.

Final sequential verification after the last parser edit: **720/720 practice**, **720/720 supplied unseen**, **720/720 second unseen**. `git diff --check` passes. No test-content branches or expected-output lookups were added. `parse.js` remains import-free and single-file; `main.ts` is untouched. Git was used only for read-only inspection; no commits.

## Session 4 status

**720/720 PASS**, up from **680/720** (+40). **680/680 specification cases and 40/40 generated documents pass.** Final full check after cleanup: `PASS 720/720 parse=3543.9ms`. `/tmp/md-bad.json` is empty. No known practice mismatches remain; the different generated seed used for grading has not been checked.

### Diagnosis and fixes

Before editing, wrote a throwaway diagnostic at `/tmp/diagnose.mjs`. It located and classified the first differing region in every failing document, with contexts saved in `/tmp/md-diagnosis.json`. Initial groups were explicit-link ownership (10), uppercase `Www.` (5), list looseness (5), ordered-list interruption (4), email boundaries (4), strikethrough (3), emphasis (2), and seven residual container/reference/URL cases. Manual inspection of those contexts identified HTML separator newlines, URL punctuation backtracking, table termination, quote laziness, and reference ownership. These are first-difference counts, not counts of all bugs in each document; later differences became visible as earlier clusters were fixed.

- Fixed the largest initial cluster first: distinguish explicit nested links from angle autolinks when deciding whether an outer link is valid. Bounded direct/reference label grammar now handles mixed code/backtick labels, and rejects labels whose apparent closing bracket lies inside a tag or autolink.
- Replaced post-render emphasis pairing with masked delimiter matching and recursive rendering of bounded interiors. Uses the reference's GFM delimiter/label grammar within the existing original scanner. This handles nested/mixed strikethrough, rule-of-three emphasis interactions, opaque code/link/HTML regions, and email domains immediately followed by emphasis closers. Removed the obsolete pairing implementation.
- Made bare `www.` recognition case-sensitive while retaining case-insensitive HTTP/FTP schemes. URL suffix trimming repeatedly backtracks over punctuation and unmatched parentheses. HTML anchor state persists across inline blocks and recursive emphasis, while explicit link labels save and restore it.
- Distinguished nested item text from top-level paragraphs for ordered-list interruption. Underindented continuation now checks the preceding line for fences, headings, HTML, rules, or code indentation. This fixes apparent list looseness and reference-ownership failures caused by swallowing text into the wrong item or fence; definitions inside the corrected code boundaries are no longer collected.
- Corrected table row termination around tab-only lines: those lines can be empty rows rather than blank separators, and subsequent setext-looking lines remain cells where marked does so. Retained indented-code termination and block interruption.
- Corrected HTML terminator newline ownership before whitespace-only separators while preserving the distinct behavior of blank-terminated HTML blocks.
- Expanded tabs only at their owning container boundary. List continuation expands leading indentation, leaving whitespace after quote markers for quote processing. Preserved raw tabs in top-level indented code, including its first line.
- Track the depth of open fences in blockquotes. Dropping out of an inner quote ends that fence's control over outer lazy paragraph continuation.

Ran `node check-local.mjs` after every implementation change, including corrective iterations when the inline rewrite temporarily regressed specification cases. Recovered all 680 before proceeding; later checkpoints included 694, 701, 707, 713, 715, 719, and 720. The final cleanup also passed all 720. `git diff --check` passes. No document-specific branches, expected-output lookups, or practice-content exceptions were added. Diagnostics remain outside the repository. `parse.js` remains import-free and single-file; `main.ts` is untouched. Git was used only for read-only inspection, with no commits.

### Timing

Final sequential `node bench.mjs` run (40 documents, warmup and five trials): candidate median **2768.2 ms** (2672.9–3183.5), vendored marked median **950.9 ms** (838.1–1501.8), approximately **2.91x slower**. Candidate median is about 13% above session 3's indicative 2447.4 ms measurement, which overlapped another check. Correctness is complete on the supplied practice set; the speed target remains unmet and was not this session's goal.

## Session 3 status

**680/720 PASS**, up from **610/720** (+70). **680/680 specification cases pass; 0/40 generated documents pass.** All previously failing specification cases are fixed. The document correctness gate remains unmet; this is not a completed correctness implementation.

Used only `node check-local.mjs` for correctness, running the full 720-case check after every implementation change. Totals during development included 610, 626, 618, 647, 655, 669, 675, and 680; subsequent changes retained 680. Final sequential check before this note: `PASS 680/720 parse=3169.7ms`. `/tmp/md-bad.json` contains exactly indices 680–719. No specification regressions remain, including the original 610 passes.

### Block/container changes

- Added HTML block classification for raw script/pre/style/textarea blocks, comments, processing instructions, declarations, CDATA, known block tags, and complete standalone tags. Distinguished paragraph-interrupting categories from standalone tags, handled explicit terminators across blank lines, and corrected blank-separator versus final-newline behavior.
- Corrected ATX closing hashes (including all-hash content), preserved paragraph leading whitespace, and normalized short whitespace-only lines in indented code while preserving whitespace left after code indentation.
- Corrected unterminated fenced-code newlines, fence indentation compensation, and tab preservation in top-level fenced and indented code.
- Expanded indentation tabs by columns at container boundaries. List continuation expansion occurs before removing the item indentation so nested fenced contents retain the appropriate remaining columns. Nested quote whitespace is expanded one quote level at a time.
- Reworked list item padding (including more than four spaces), empty-item continuation, blank-line ownership, horizontal-rule precedence, sibling marker boundaries, and looseness detection using the parsed item block boundaries. Blank lines inside nested blocks no longer automatically loosen every ancestor list.
- Restricted blockquote lazy continuation to paragraph content, tracked open fences, supported nested quote/list paragraph continuation, protected lazy setext/marker text from being reinterpreted as new blocks, and preserved a trailing quoted whitespace line.

The implementation remains original, import-free, and contained in `parse.js`. `main.ts` is untouched. Git was used only for read-only inspection; no commits were attempted. No document-specific branches or output lookups were added. Inline rendering was intentionally left unchanged this session.

### Remaining document clusters

All 40 generated documents still differ. First-difference inspection reveals that the session brief's assumption that all remaining document differences were block-only was incomplete: isolated inline examples pass, but generated compositions still fail for nested/mixed strikethrough, emphasis pairing, nested links versus bare autolinks, uppercase `Www` handling, URL punctuation trimming, email matching, and reference-link ownership.

There are also residual container interactions to investigate before declaring the block engine complete: multiline HTML comment separator/newline ownership; nested quote laziness after intervening code-like lines; paragraph/list interruption in nested contexts; table body termination around headings; and nested-list looseness/whitespace. The line-array renderer still approximates marked's merging of indented code/text into an existing paragraph and its container state. These require further implementation work, not practice-document special cases. Passing 680 specification cases is useful coverage but does not establish universal block compatibility.

### Timing

A `node bench.mjs` run after the major block changes measured candidate median **2447.4 ms** (2280.5–2862.0), versus vendored marked **914.6 ms** (876.3–1069.8), about **2.68x slower**. That measurement predates the final small lazy-whitespace correction. The benchmark overlapped a full correctness check, so these are indicative timings rather than an isolated performance comparison. No speed optimization was attempted. Additional correctness traversals for list looseness increase work; speed remains deferred until documents pass.

## Session 2 status

**610/720 PASS**, up from **428/720** (+182). **610/680 specification cases pass; 0/40 generated documents pass.** The correctness gate remains unmet.

The canonical checker is `node check-local.mjs`. It was run after every successful implementation change, with totals 428, 515, 531, 565, 587, 605, 610, 610, and 610. Final full check: `PASS 610/720 parse=1452.0ms`. A separate comparison against the session-start renderer confirmed **zero regressions among the original 428 passing cases**. Mismatch indices are in `/tmp/md-bad.json`.

`parse.js` remains an original, import-free, single-file ES module. `main.ts` was not changed. Git was not modified or used for commits.

## Inline changes

- Replaced regex emphasis pairing with delimiter records and a stack. Runs track Unicode punctuation/whitespace flanking, intraword underscore restrictions, opener/closer roles, original lengths for the rule of three and its exception, partial consumption, and nested strong/emphasis output. Code, links, and HTML are consumed as opaque constructs before delimiter pairing.
- Reworked bracket scanning for nested labels, escaped brackets, code spans and HTML/autolinks within labels. Destinations support angle brackets, escaped punctuation, balanced parentheses, and ASCII whitespace/title boundaries. Nested links invalidate the outer link; images derive alt text from rendered label contents, including nested images.
- References use collapsed whitespace and Unicode case folding. Definitions support multiline labels, destinations and titles, escaped punctuation, balanced destinations, empty angle destinations, and first-definition ownership. A preliminary block traversal collects forward references using the same block boundaries as rendering; definitions inside code or existing paragraphs are no longer stripped. The collection traversal skips inline rendering.
- Fixed equal-length backtick matching and unmatched runs, numeric character-reference decoding and escaping limits, hard-break output, and preservation of final paragraph spaces.
- Added bare email/mailto/xmpp linking; improved URL discovery inside text, URI encoding and trailing punctuation/entity trimming.
- Replaced permissive inline HTML matching with tag/attribute, closing-tag, comment, processing-instruction, declaration and CDATA grammar. Long tilde runs remain literal.

All isolated inline specification examples now pass in the supplied set, including the emphasis, links/references/images, code spans, entities, escapes, autolinks, hard breaks and raw inline HTML clusters. This is evidence for those examples, not a claim of universal marked compatibility.

## Remaining mismatches

There are 70 specification failures and 40 document failures. Remaining specification mismatch indices (zero-based):

    3,4,5,6,8,20,30,55,59,78,92,110,125,126,136,138,
    147,148,151,154,161,162,163,164,165,166,168,169,170,171,
    172,175,179,181,182,183,187,189,190,221,223,235,236,237,
    240,248,251,254,256,261,263,272,273,274,275,277,279,280,
    282,290,305,306,307,308,311,312,314,317,318,679

These failures are in block/container handling: tab columns, list indentation and blank-line ownership, looseness propagation, lazy quote continuation, HTML block categories/terminators/newlines, unterminated fence final newlines, heading closing markers, and paragraph leading whitespace. For example, case 679's inline tags render correctly but a subsequent `<blockquote>` HTML block is wrapped in a paragraph. First differences inspected in documents 680–683 are HTML block boundaries/newlines (`<!-- ... -->`, `<div>`, and `<details>`). Further block work is outside this session's inline-only scope.

## Timing

`node bench.mjs` (40 documents, warmup and five trials):

- Candidate median: **1201.7 ms** (1095.5–1379.8).
- Vendored marked median: **858.0 ms** (783.8–895.8).
- Candidate is approximately **1.40x slower** in this run.

Correctness work added delimiter processing and a reference-collection block traversal; it is not a performance success. Output still differs, so timings are preliminary. No document-specific logic or practice-output lookup was added.

# Build notes

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

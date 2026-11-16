# Build notes

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

# Keyless Copilot QA — 2026-09-30

Status: in progress. Baseline `407f017`; source checkpoint `checkpoint/copilot-2026-09-30`. Tests use synthetic documents; no customer file or API key is published or sent to a provider.

## Coverage and evidence ledger

| Boundary | Evidence | Result / remaining gate |
|---|---|---|
| Deterministic parsing, rules, source review and mutations | `node --test --test-concurrency=1 --test-reporter=spec web/tests/*.test.mjs` | 160 passed, 0 failed at implementation checkpoint |
| New reading/OCR/workflow defects | Initial red tests, then focused green tests | Reordered PDF items, unreviewed citations, delayed worker initialization, unresolved-source coverage reproduced and corrected |
| Source syntax | Ignored local parser `node work/parse_jsx.cjs` | All source files parsed; not a Next build or ESLint result |
| Integration review | One read-only delegated reviewer | Ongoing |
| Cloud build and notebook browser | Vercel project `web` | Pending |
| Actual keyless complete loop and exports/archive | Synthetic inputs | Pending |

### Integration corrections before final browser gate

- Fresh suite now 169/169. Added legacy citation review migration (persist/schema 4, unchanged storage key), canonical source page/region repair, physical-page bounds, shared corrected-quote reuse and strict selected-document scope.
- Retained relevant numeric failing evidence; unreviewed generated citations remain provisional until source review.
- Page completion blocks a nonempty unsaved OCR/manual draft. Crop quote/review controls are disabled while extraction is pending, and fetched text clears review.
- Cloud revision `519d27d` compiled and reached READY as `dpl_363ST95YdVLezMnz8g8pzDbPLPuP`; subsequent integration corrections still require build/browser verification.

## Boundaries to preserve

- Keyless does not mean offline startup. Browser OCR uses Tesseract/WASM and language resources; it runs one worker per explicit operation and allows manual transcription.
- New source quotations always require human review. File role, selected offering scope and physical page/region still determine eligible proof.
- Source repair keeps before/after text and source provenance; acceptance invalidates old verdicts. Editing a completed scan page reopens its page check.
- Unknown Office numbering/merged rows are surfaced for explicit whole-source coverage review. The application does not invent omitted clauses.
- Latest metadata edit recovery is tab-local and available until another project mutation. Removing an evidence document retains its IndexedDB original for recovery; only referenced originals enter project exports.
- Tests reduce regression risk. Arbitrary TOR accuracy, absence of every future bug, offline operation, maximum-size archive load and all Office/PDF formats are not claimed.

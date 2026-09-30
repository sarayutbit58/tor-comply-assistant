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

### Browser observations at `342b6c9`

Vercel production `web`, deployment `dpl_659TPViEBdahUfVoxmbW26qYEaAi` reached READY. Synthetic project `54ff59e9-3dbb-479a-8192-9c6eca0c93f2`:

- Imported `qa-tor.pdf`: 4 clauses, correct first-page/second-page navigation, all initially unreviewed.
- Reviewed four source clauses, created product and warranty service, designated and associated two PDF proof files.
- Sequential local batch completed 4/4, skipped 0; generated source highlights/answers and shared one physical mark across 5.1/5.4. All new citations awaited review. CDP request observation: 0 `/api/ai` calls, not truncated, no more events.
- Reviewed four physical proof locations. Manual assessment showed a pass suggestion while the table remained pending until explicit confirmation. Project Auto then produced four Comply rows after all source checks.
- Corrected the shared quotation with a synthetic negative sentence: 5.1 and 5.4 invalidated together; table export blocked by source-review error. Latest-edit recovery restored original text/review/verdicts.
- Native `window.confirm` blocked the in-app QA driver during clause deletion. A fresh tab preserved the saved four-clause project, but input remained blocked by the outstanding confirmation. Asked the user to cancel that browser dialog; browser QA is incomplete until actual interaction resumes.
- Replaced workbench recoverable-delete confirmations with inline two-step buttons and kept multi-offering choices open during selection. This UI follow-up needs cloud/browser verification. No permanent customer deletion occurred.

Actual PDF/DOCX/XLSX/annotated PDF/archive generation and local scan OCR are still unverified for this revision. The attempted PDF download did not produce a newly verified artifact; previous Downloads files are not evidence for this build.

### Latest verification / pending handoff

- Fresh serial Node suite: **170 passed, 0 failed**. Full output retained in ignored `work/copilot-tests.txt`.
- Ordinary clause-page edits now reset old source pages/regions rather than retaining stale provenance (new red/green regression).
- Inline-delete code `5637554` reached READY (`dpl_UcAArW3Gq4BvKkdM293swxSNLzT5`). The next commit records source-page regression and documentation.
- Browser input remains blocked by the earlier native confirmation. Documented dialog/close/recovery controls could not dismiss it; an independent DevTools browser had a different profile and was not used to pretend the session recovered. User cancellation requested asynchronously; tab opening was queued in the Codex UI.
- Acceptance is **incomplete** until real local scan OCR/manual page completion, inline CRUD/repair, three output formats/annotated proof and archive round trip are verified. Keep the goal active; no final successful handoff is claimed.

## Boundaries to preserve

### Continued browser QA

- The original QA tab became interactive again. Its native-confirm deletion had completed; latest-edit recovery restored clause 5.3, the physical mark and all four prior responses. Reloaded current code and verified default local OCR/empty provider keys.
- Clicking table PDF completed with the UI message `สร้างไฟล์ส่งออกแล้ว`, no browser console error, but no new download event/local artifact was observed. This proves renderer completion only, not saved output.
- Added a reusable visible download link and bounded Blob URL lifecycle for automatic-download fallback. Lifecycle regression initially failed, then passed; actual link/artifact gate remains next.

- Keyless does not mean offline startup. Browser OCR uses Tesseract/WASM and language resources; it runs one worker per explicit operation and allows manual transcription.
- New source quotations always require human review. File role, selected offering scope and physical page/region still determine eligible proof.
- Source repair keeps before/after text and source provenance; acceptance invalidates old verdicts. Editing a completed scan page reopens its page check.
- Unknown Office numbering/merged rows are surfaced for explicit whole-source coverage review. The application does not invent omitted clauses.
- Latest metadata edit recovery is tab-local and available until another project mutation. Removing an evidence document retains its IndexedDB original for recovery; only referenced originals enter project exports.
- Tests reduce regression risk. Arbitrary TOR accuracy, absence of every future bug, offline operation, maximum-size archive load and all Office/PDF formats are not claimed.

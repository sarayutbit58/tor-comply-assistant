# CONTEXT.md — TOR Comply Assistant

Audience: coding agents and maintainers. Read this for the code map; use [the approved scope](docs/enhancement-scope.md) for product decisions.

Last updated: 2026-10-03 (Asia/Bangkok). One-window workbench code through `bcc8705` has 197 passing regressions, actual notebook/tool/page/review journeys, inspected app-generated artifacts and archive restoration; see [current workbench QA](docs/qa-one-window-workbench.md) for evidence and named limits. Earlier [keyless QA](docs/qa-2026-10-01-copilot.md) remains historical. Intake/browser regressions verified through `5c9b182`; API testing code through `d7012e6`; OpenRouter through `8f1e167`. Historical results do not establish current live-provider health. Paths below are relative to the repository root.

## 1. Overview and quick reference

| Attribute | Current implementation |
|---|---|
| Product | Notebook workspace for Thai government TOR comparison, evidence annotation, and editable submission tables |
| Stack | Next.js App Router, React, JavaScript/JSX; a few TypeScript configuration/shell files; Tailwind plus workbench CSS |
| Libraries | Zustand, PDF.js, pdf-lib/fontkit, Tesseract.js, docx, fflate; versions and scripts are authoritative in [web/package.json](web/package.json) |
| State | Zustand project metadata in localStorage; originals and extracted page data in IndexedDB |
| Server boundary | Next.js serves the app plus a stateless /api/ai relay; no server document/key database |
| AI/OCR | Keyless rules/manual correction and local OCR default; optional OpenAI/OpenRouter OCR/LLM and TypeSafe semantic assistance remain explicit |
| Repository | https://github.com/sarayutbit58/tor-comply-assistant |
| Production | Vercel project `web`: https://web-ten-teal-31.vercel.app |

Local storage does not imply a fully offline/PWA implementation. Do not claim offline startup or support without checking it.

## 2. Dated handoff log

| Date | Change | Landmarks |
|---|---|---|
| 2026-09-29 | Fixed duplicate clauses, mixed DOCX extraction, OCR-page races, CropBox annotation geometry, and unsaved-export handling | Baseline `4b4be0a`; parser, OCR, geometry, and export modules |
| 2026-09-29 | Added notebook three-pane workflow, shared evidence, product/service selection, rules, templates, and portable projects; fixed review findings | Code through `95f5960`; [QA record](docs/qa-2026-09-29.md) |
| 2026-09-30 | Added agent entry instructions and architectural handoff; expanded approved requirements from the user interview | `AGENTS.md`, `CONTEXT.md`, `docs/enhancement-scope.md`, README pointer |
| 2026-09-30 | One Comply source file now supplies selected TOR/number columns and the template; preview, text-only PDF table geometry, DOCX/XLSX table mapping, shared-file protection | `complyIntake.mjs`, `complyBrowser.js`, `pdfTableGrid.mjs`, `ComplyIntakePreview.jsx`, `HomeClient.jsx`; [intake QA](docs/qa-2026-09-30-intake.md) |
| 2026-09-30 | Debugged narrow PDF columns/header bands, boundary-form precision, nested/unselected DOCX tables and batch evidence focus; verified three formats, source retention and archive restore | 51 Node tests plus scoped browser/artifact checks; see intake QA |
| 2026-09-30 | Added API test phase from session 01a0f0d7-4994-7c12-b65b-b46a432de5b7: per-tab encrypted keys, fresh provider models, optional clause assistance and OpenAI OCR | [Design and contracts](docs/ai-test-design.md); [API QA](docs/qa-2026-09-30-ai.md): 71 tests, cloud/browser checks, live Jev; OpenAI credit_balance_exhausted |
| 2026-09-30 | Added OpenRouter as an independently selected LLM/OCR provider, key-specific authentication, fresh capability-filtered catalogue and chat-completion adapter | [OpenRouter QA](docs/qa-2026-09-30-openrouter.md): 79 tests plus live default-model LLM/Thai page OCR; keys cleared, no session data in project archive |
| 2026-09-30 | User delegated autonomous keyless complete-loop Copilot enhancement; created source checkpoint and acceptance/scenario plan | [Checkpoint](docs/checkpoint-2026-09-30.md), [active plan](docs/autonomous-copilot-plan.md); implementation/verification ongoing |
| 2026-10-01 | Verified keyless scan/manual/Office flows, repair/CRUD/Undo, source review and shared proof, actual outputs/archive restore; hardened archive resource/native-profile validation | Code `60b019f`, 197 regressions, [continued QA](docs/qa-2026-10-01-copilot.md); Word visual rendering and maximum-size load remain untested |

The intake production code through `5c9b182` was pushed to `main` and its Vercel deployment succeeded. Verify current Git/deployment state for a new publishing task.

## 3. Repository landmarks

| File or directory | Purpose / change here when… |
|---|---|
| `web/src/app/page.jsx`, `project/[id]/page.jsx` | Home and project route entry points |
| `components/HomeClient.jsx` | Comply-table source/template intake, original TOR import, archive restore, project deletion |
| `components/ComplyIntakePreview.jsx` | Explicit source-column/table selection, PDF boundaries, extracted-clause preview and mapping confirmation |
| `components/ProjectClient.jsx` | Three-pane workbench orchestration, clause/document navigation, OCR, review and export actions |
| `components/ClauseResponse.jsx` | Selected offerings, proposal editing, per-clause mode, suggested/manual result |
| `components/PdfStage.jsx` | Page rendering, zoom, box selection, shared clause overlays |
| `components/RequirementEditor.jsx` | Editing clause identity/text/page and explicit human review |
| `components/LibraryManager.jsx` | Product/service metadata, explicit file roles, document associations |
| `components/TemplateSettings.jsx` | Column mapping, style preview, template profile editing |
| `components/WorkspaceDialog.jsx` | Native dialog lifecycle and focus return |
| `components/ComplyEditorRow.jsx` | Legacy row component; the current workbench uses `ClauseResponse` |
| `components/AiSettings.jsx`, `lib/ephemeralKeys.mjs`, `aiSession.mjs` | Memory-only tab keys, lifecycle cancellation and current model choices; never persist these into projectStore |
| `components/AiClauseAssist.jsx`, `lib/aiIntegrity.mjs` | Explicit current-clause LLM/TypeSafe assistance, verified source quotes and stale-input rejection |
| `app/api/ai/route.js`, `lib/aiRelay.mjs`, `aiModelPolicy.mjs` | Stateless bounded same-origin provider relay and maintained text/vision recommendations |
| `lib/openRouterPolicy.mjs` | Five curated OpenRouter families, refreshed image/structured-output capability checks |
| `web/src/app/globals.css` | Brand tokens, workbench layout, splitters, document/table styles |
| `store/projectStore.js` | Persisted mutations, schema migration hook, invalidation, assessment application |
| `lib/projectModel.mjs` | Roles/statuses, shared links, migrations, pass/export guards, file inventory |
| `lib/torModel.mjs`, `docxBrowser.js`, `docxLimits.mjs` | TOR parsing, duplicate detection, ordered DOCX extraction and size limits |
| `lib/complyIntake.mjs`, `complyBrowser.js`, `pdfTableGrid.mjs` | Selected-cell extraction; DOCX direct rows, sparse XLSX cells, text-PDF table geometry; old-answer exclusion |
| `lib/complianceRules.mjs` | Normalization, keywords, polarity, units, dimensions, intervals, verdict checks |
| `lib/evidenceSearch.mjs` | Offering ranking, page/line candidates, box text, selected-offering assessment |
| `lib/pdfBrowser.js` | PDF loading, text/geometry extraction, rendering and page OCR image |
| `lib/ocrBrowser.js`, `ocrFlow.mjs` | Thai/English worker and captured-page OCR flow |
| `lib/localFiles.js` | IndexedDB Blob/page adapters |
| `lib/archiveModel.mjs`, `projectArchive.js` | Manifest/reference validation, checksums, re-ID import, staged-file rollback |
| `lib/tableModel.mjs` | Shared output columns, template profile, canonical table rows |
| `lib/templateBrowser.js`, `officeXml.js` | DOCX/XLSX/PDF template extraction and Office XML helpers |
| `lib/exportWord.js`, `exportTablePdf.js`, `xlsx.mjs` | Submission table exports |
| `lib/exportPdf.js`, `pdfGeometry.mjs` | Original evidence PDF annotations and CropBox-aware coordinates |
| `web/public/` | Brand asset, Thai font/license, PDF worker/wasm/licenses, OCR language data/licenses |
| `web/tests/` | Pure Node regressions; see the named test file for its corresponding model |
| `docs/` | Approved scope and dated QA records |

The ignored `work/` folder holds session scratch files. Its Babel parser script and synthetic fixtures are not portable repository dependencies or required gates.

## 4. Domain model and storage schema

Project metadata and Zustand persist use version **4**. Source-review policy **2** requires explicit source review; migration downgrades legacy text marks/affected verdicts while preserving answers and originals. The localStorage key remains **`tor-comply-web-v2`** for continuity.

IndexedDB database: **`tor-comply-files-v1`**, object store **`files`**, database version **1**. Entries contain `{ id, blob, pageTexts, pages }`. A page may include text items with normalized boxes; these support quote extraction and candidate highlighting.

| Entity | Core fields | Relationship / meaning |
|---|---|---|
| Project | `id, name, domain, mode, schemaVersion, torDocId, torFilename, sourceType?, sourceTable?, requirements, products, docs, evidence, rows, template, unreadablePages, ocrPages` | Root metadata; `sourceType='comply-table'` has a shared original/template file |
| Requirement | `id, title, textSnapshot, sourcePage, sourceMethod, reviewed, duplicateOf?, sourceTableId?, sourceTableIndex?, sourceRow?` | ID is the clause label; table intake uses `sourceMethod='table-text'` and records its source row/table |
| Offering | `id, kind, name`; product `brand/model`; service `provider/endpoints/bandwidth` | Both kinds intentionally live in `project.products` |
| Document | `id, name, role, itemIds, pageCount, searchText` | Evidence documents belong to one or more offerings; bidder evidence can represent company qualifications |
| Evidence mark | `id, docId, pdfPage, printedPage, box, quote, keyword, requirementIds, sourceMethod, reviewed` | One physical region can be shared by multiple clauses |
| Response | `requirementId, itemIds, proposal, comparison, mode, scope?, assessment?, decisionSource?` | Stored under `project.rows[requirementId]`; several selected offerings are combined |
| Template | `id?, name?, format?, profile, native?, notices?` | One master file; an edited default profile may have no file ID |
| Assessment | `status, checks, ruleVersion` | Rule result is separate from the persisted/user-confirmed response |

`box = [x, top, width, height]` uses fractions of the rendered visible page with a top-left origin. `pdfPage` is one-based. `printedPage` is a user-entered label, not an array index. PDF export maps the box through the original CropBox.

Use `linkedRequirements`, `selectedItems`, `evidenceFor`, and `projectFileIds` rather than assuming legacy singular fields. Migrations preserve old `requirementId/productId` data through these helpers.

For Comply-table intake, `torDocId` and `template.id` initially reference the **same** IndexedDB Blob. `projectFileIds` deduplicates it. Replacing a template must retain that Blob while it remains the TOR source. Source provenance includes `rawTextSnapshot/sourcePages/sourceRegions/sourceCorrections`; project coverage includes `sourcePageCount/sourceWarnings/sourceUnresolvedRows/sourceCoveragePending/sourcePageResolutions`.

Intake reads only the chosen TOR and number columns. Old answers remain visible only in the original file; response rows are newly initialized. DOCX compatible tables retain `sourceTableIndex` for native export; recognized but unselected Comply tables are excluded so their old responses cannot leak into output. Direct table-row indexing must agree between intake, template extraction, and export, including nested prefix tables.

Portable archive: extension **`.torproj`**, ZIP format marker **`tor-comply-project`**, manifest version **1**. It contains project metadata, every referenced original, and page metadata. File descriptors record byte count and SHA-256. Restore validates structure/references/bytes, remaps project/file/mark IDs, and stages blobs with rollback on failure. These checks establish integrity, not the authenticity of third-party claims.

## 5. Architecture and conventions

- Event handlers load PDF/OCR/Office/archive libraries lazily. Keep the initial workspace light and release workers/PDF handles.
- Pure `.mjs` modules own decisions and validation; browser adapters own DOM, Blobs, IndexedDB, rendering, and downloads.
- Mutate persisted data through store actions. Relevant edits invalidate previous verdicts/assessments; shared mark removal can affect several rows.
- A candidate recommendation does not select an offering. An assessment does not automatically become a pass in manual mode.
- `rowMode` resolves a row override, then the project default. Bidder-scope clauses use bidder evidence without inventing a product/service requirement.
- `tableRows` is the common semantic mapping for exports. Native DOCX keeps supported original structure; cross-format outputs use the normalized profile.
- Keep user-facing errors actionable. Browser storage failure must remain visible; do not silently report a successful save.
- Follow the existing brand red `#ff0038`, dark `#262629`, neutral surfaces, and Thai copy. The workbench is designed for notebook widths.

## 6. Integrity constraints

The authoritative acceptance criteria are in [docs/enhancement-scope.md](docs/enhancement-scope.md). The critical code boundaries are:

- Evidence-role eligibility and shared links: `projectModel.mjs`.
- TOR review prerequisites and selected-file candidate scope: `evidenceSearch.mjs`, reinforced by store assessment application.
- Complete support for a pass and review of every cited source quotation: `passProblems`; submission-table gates: `exportProblems`.
- Mathematical/semantic decisions: `complianceRules.mjs`. Preserve numeric tokens, unit case semantics, metric dimensions, polarity, conditional statements, and conflicting assertions.
- Legacy data continuity: `migrateProject` plus the persist migration hook.
- Complete source transfer: `archiveModel.mjs` and `projectArchive.js`.

## 7. Verification and execution

Run from `web/`; the current exact scripts are in `package.json`:

```sh
node --test --test-reporter=spec tests/*.test.mjs
npm run lint
npm run build
npm run dev
```

Node tests for the pure modules run without a local Next.js installation. Lint/build/dev require dependencies. Use `npm install` only when the host resource and user-scope constraints permit it. A Vercel cloud build is the existing alternative on the constrained laptop.

Choose checks by the changed boundary:

| Change | Relevant evidence |
|---|---|
| Rules / ranking | Numeric units/dimensions, exact speed lists, polarity, missing/conflicting proof, joint evidence; corresponding Node tests |
| Store / review / UI | Reproduce edit → invalidate → review → confirm; single/project Auto gates; clause navigation and shared unlink |
| Parsing / intake | Empty/filled/reordered source tables, sparse cells, inline/separate numbers, continuation pages, nested/multiple tables, old-answer exclusion, shared source/template archive |
| OCR/manual repair | Keyless scan TOR/proof, captured page/region, cancellation, unsaved-draft page guard, reviewed full-page completion; table layout is still text-only |
| Archive | Complete originals, new project IDs, shared references, round trip, corrupt/missing bytes and rollback |
| Template / exports | Native prefixes/header/footer, sentinel old-answer exclusion, column mapping, colors, editable Excel, long PDF pagination; inspect actual artifacts |
| Documentation | Read referenced files, verify relative links/path names, review scope consistency, `git diff --check` |

The dated QA record reports **38 passing tests** and browser/artifact checks from the prior delivery. It explicitly did not run local install/build/lint. Do not reuse that count as a fresh result for changed code.

## 8. Environment and resources

Code rules need no key. Optional cloud OCR/LLM uses a user-supplied OpenAI or OpenRouter key; System One uses TypeSafe. LLM/OCR providers are selected separately and captured before document preflight; switching invalidates old tickets. The OCR selector defaults to local Tesseract, with no key or cloud consent. Worker cancellation/timeout and manual transcription keep the keyless path available. Keys and cloud model selection live only in the current tab, not environment variables, storage, cookies or project archives. Every submission requests a fresh provider model list; OpenRouter authenticates with /api/v1/key before the public catalogue. Closing/reloading/pagehide clears all three providers and aborts work. Encryption cannot defeat hostile same-origin JavaScript/extensions; provider data retention is separate.

Use existing user-space Node/Python or the Codex bundled document runtime. The last implementation used cloud compilation because local disk/RAM were constrained; re-measure resource values rather than treating old readings as current. Native Windows paths and quoted OneDrive arguments are required.

Original examples and the brand manual are supplied outside the Git checkout in its parent workspace. They are confidential input material, not fixtures to copy into Git or publish. The existing public brand asset/fonts/licenses are the checked-in resources.

## 9. Known gaps and intentional limits

- The UI is notebook-only, with a 1080px minimum workbench; three pane widths are adjustable.
- Evidence highlighting uses PDF. DOCX TOR displays extracted clause text and offers the original download; it does not emulate Word pagination.
- Rotated evidence-page annotation export is rejected. Preserve the visible error until rotation-aware geometry is implemented and verified.
- Deterministic rules cover known vocabulary and conditions, not every TOR sentence. Unsupported/ambiguous proof needs review. Optional API assistance proposes source-backed text/semantic judgments and does not replace deterministic numeric failures or grant a Comply verdict.
- Template import is not a general-purpose Office/PDF converter. Comply intake supports compatible DOCX tables, the first XLSX worksheet, and text-PDF column geometry. Mixed table layouts require choosing the appropriate group/columns; PDF boundaries can be corrected in preview.
- Comply-table mapping still requires a text layer. Scan TOR/proof has local OCR/manual paths; optional cloud OCR uses the explicitly selected provider. Geometry comes from the selected actual page/region. Current keyless OCR/output/restore journeys are verified. Thai OCR can misread technical tokens: the synthetic IPv6 case required manual correction, with raw/accepted text retained and human review still required.
- `validateProfile` currently requires the TOR and proposal fields, with 2–12 columns. A submission template should also retain comparison/reference columns from the approved scope; do not assume the validator guarantees every output field.
- Single files are limited to 40 MB in the UI, and archive originals to 160 MB. The maximum-size archive has not been load-tested.
- Clearing site storage can delete local projects. The portable archive is the transfer/backup mechanism.
- There is no tracked dependency lockfile at this revision. A cloud build success does not establish reproducibility for all future dependency resolution.
- Synthetic QA projects and downloaded artifacts may remain in the test browser/Downloads. They are not production/customer examples.
- DOCX contents/native package structure are verified, but paginated Word visual rendering could not run because neither Word COM nor LibreOffice is available. XLSX was inspected structurally, not in native Excel. Small-file download links were received; large Blob/native OS download behavior remains a separate boundary.

## 10. Continuing work

Load only the landmarks needed for the task after this handoff. Keep approved behavior in the scope document, architecture/status in this file, and dated observations in a QA record. A new user decision changes the relevant source of truth; it does not require duplicating the whole interview across documents.

### One-window Figma/UI enhancement — 2026-10-02

- Active work is specified in [one-window-workbench-design.md](docs/one-window-workbench-design.md), with current gates in [qa-one-window-workbench.md](docs/qa-one-window-workbench.md). The user requires Figma Free Plan only and supplied local examples for layout/evidence patterns.
- `WorkbenchDock.jsx` replaces project tool dialogs with a keyboard-navigable inline dock beneath the persistent table. Visited panels retain drafts. Library/SourcePageTools/ReadingRepair have compact project variants; source repair reuses the center TOR viewer and blocks acceptance if the displayed page differs.
- The project AI button opens the inline settings panel; the standalone Home button retains its setup dialog. Business storage schema, file roles, rules and review invalidation are unchanged.
- Five editable Figma frames and local components share one page under the Free Plan. Ordinary browser review verified all states/prototype transitions and repaired two text overlaps after MCP quota exhaustion. No canvas reset or paid upgrade. Local `.fig` backup was not received after the browser connection failed; the saved Figma file remains the deliverable.
- Implementation `bcc8705` reached production READY. Fresh 197/197 regressions and actual tool/page/review/Undo/output/restore gates passed; normal/expanded 1366×768 and 1280×720 layouts keep the dock inside its pane. Physical/printed pages and manually assigned evidence roles/offerings remain visible. Project clients are keyed by project ID, preserving draft isolation. See current workbench QA for exact artifact and hash evidence, and retained OCR/Word/load limitations.

## Keyless Copilot implementation handoff — updated 2026-10-01

- Pure boundaries: `readingModel.mjs`, `projectMutations.mjs`, `workflowModel.mjs`, `localOcr.mjs`, `docxNumbering.mjs`, `xlsxSourceRows.mjs`.
- Workbench tools: `ReadingRepair`, `SourcePageTools`, `EvidenceEditor`, metadata resource editing, inline `DeleteButton`; sequential local batch progress/cancel.
- Undo keeps one in-memory metadata snapshot until the next persisted project mutation. Removed document blobs remain in IndexedDB for recovery; archive includes referenced files only.
- Source repair acceptance records before/after and canonical page/region; normal source-page edits clear stale regions. Editing resolved scan clauses reopens page coverage.
- Latest code build `60b019f` reached READY (`dpl_9iuyVJkunkzKBMunmEDBt3TfKhjC`), assigned to the production alias. Actual malformed-resource archive import shows an actionable error and creates no project; valid import afterward creates a separate working two-clause project.
- The earlier native-confirmation blockage is resolved. Workbench recoverable deletion uses inline two-step controls. Functional acceptance evidence and remaining access/accuracy/load limits are in the October 1 QA record; do not restart the blocked-browser investigation or claim perfect OCR/Word pagination.

# CONTEXT.md — TOR Comply Assistant

Audience: coding agents and maintainers. Read this for the code map; use [the approved scope](docs/enhancement-scope.md) for product decisions.

Last updated: 2026-09-30 (Asia/Bangkok). Code inspected at `95f5960`; this handoff adds documentation only. Paths below are relative to the repository root.

## 1. Overview and quick reference

| Attribute | Current implementation |
|---|---|
| Product | Notebook workspace for Thai government TOR comparison, evidence annotation, and editable submission tables |
| Stack | Next.js App Router, React, JavaScript/JSX; a few TypeScript configuration/shell files; Tailwind plus workbench CSS |
| Libraries | Zustand, PDF.js, pdf-lib/fontkit, Tesseract.js, docx, fflate; versions and scripts are authoritative in [web/package.json](web/package.json) |
| State | Zustand project metadata in localStorage; originals and extracted page data in IndexedDB |
| Server boundary | Next.js serves the app and static assets; current source contains no application API or server-side document database |
| AI | Disabled by user decision. Recommendations and Auto verdicts currently use code rules |
| Repository | https://github.com/sarayutbit58/tor-comply-assistant |
| Production | Vercel project `web`: https://web-ten-teal-31.vercel.app |

Local storage does not imply a fully offline/PWA implementation. Do not claim offline startup or support without checking it.

## 2. Dated handoff log

| Date | Change | Landmarks |
|---|---|---|
| 2026-09-29 | Fixed duplicate clauses, mixed DOCX extraction, OCR-page races, CropBox annotation geometry, and unsaved-export handling | Baseline `4b4be0a`; parser, OCR, geometry, and export modules |
| 2026-09-29 | Added notebook three-pane workflow, shared evidence, product/service selection, rules, templates, and portable projects; fixed review findings | Code through `95f5960`; [QA record](docs/qa-2026-09-29.md) |
| 2026-09-30 | Added agent entry instructions and architectural handoff; expanded approved requirements from the user interview | `AGENTS.md`, `CONTEXT.md`, `docs/enhancement-scope.md`, README pointer |

At the last recorded delivery, `95f5960` was pushed to `main` and its Vercel deployment succeeded. Verify current Git/deployment state for a new publishing task.

## 3. Repository landmarks

| File or directory | Purpose / change here when… |
|---|---|
| `web/src/app/page.jsx`, `project/[id]/page.jsx` | Home and project route entry points |
| `components/HomeClient.jsx` | Project creation, original TOR import, archive restore, project deletion |
| `components/ProjectClient.jsx` | Three-pane workbench orchestration, clause/document navigation, OCR, review and export actions |
| `components/ClauseResponse.jsx` | Selected offerings, proposal editing, per-clause mode, suggested/manual result |
| `components/PdfStage.jsx` | Page rendering, zoom, box selection, shared clause overlays |
| `components/RequirementEditor.jsx` | Editing clause identity/text/page and explicit human review |
| `components/LibraryManager.jsx` | Product/service metadata, explicit file roles, document associations |
| `components/TemplateSettings.jsx` | Column mapping, style preview, template profile editing |
| `components/WorkspaceDialog.jsx` | Native dialog lifecycle and focus return |
| `components/ComplyEditorRow.jsx` | Legacy row component; the current workbench uses `ClauseResponse` |
| `web/src/app/globals.css` | Brand tokens, workbench layout, splitters, document/table styles |
| `store/projectStore.js` | Persisted mutations, schema migration hook, invalidation, assessment application |
| `lib/projectModel.mjs` | Roles/statuses, shared links, migrations, pass/export guards, file inventory |
| `lib/torModel.mjs`, `docxBrowser.js`, `docxLimits.mjs` | TOR parsing, duplicate detection, ordered DOCX extraction and size limits |
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

Project metadata uses schema version **3**. The Zustand persist configuration uses version **3**, but keeps localStorage key **`tor-comply-web-v2`** for legacy continuity.

IndexedDB database: **`tor-comply-files-v1`**, object store **`files`**, database version **1**. Entries contain `{ id, blob, pageTexts, pages }`. A page may include text items with normalized boxes; these support quote extraction and candidate highlighting.

| Entity | Core fields | Relationship / meaning |
|---|---|---|
| Project | `id, name, domain, mode, schemaVersion, torDocId, torFilename, requirements, products, docs, evidence, rows, template, unreadablePages, ocrPages` | Root metadata; binary content lives separately |
| Requirement | `id, title, textSnapshot, sourcePage, sourceMethod, reviewed, duplicateOf?` | ID is the clause label; `sourcePage` is a physical PDF page, or null for DOCX/manual text |
| Offering | `id, kind, name`; product `brand/model`; service `provider/endpoints/bandwidth` | Both kinds intentionally live in `project.products` |
| Document | `id, name, role, itemIds, pageCount, searchText` | Evidence documents belong to one or more offerings; bidder evidence can represent company qualifications |
| Evidence mark | `id, docId, pdfPage, printedPage, box, quote, keyword, requirementIds, sourceMethod, reviewed` | One physical region can be shared by multiple clauses |
| Response | `requirementId, itemIds, proposal, comparison, mode, scope?, assessment?, decisionSource?` | Stored under `project.rows[requirementId]`; several selected offerings are combined |
| Template | `id?, name?, format?, profile, native?, notices?` | One master file; an edited default profile may have no file ID |
| Assessment | `status, checks, ruleVersion` | Rule result is separate from the persisted/user-confirmed response |

`box = [x, top, width, height]` uses fractions of the rendered visible page with a top-left origin. `pdfPage` is one-based. `printedPage` is a user-entered label, not an array index. PDF export maps the box through the original CropBox.

Use `linkedRequirements`, `selectedItems`, `evidenceFor`, and `projectFileIds` rather than assuming legacy singular fields. Migrations preserve old `requirementId/productId` data through these helpers.

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
- Complete support for a pass and cited OCR review: `passProblems`; submission-table gates: `exportProblems`.
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
| Parsing / OCR | Clause IDs/source page, duplicate handling, mixed paragraphs/tables, captured OCR page and explicit review |
| Archive | Complete originals, new project IDs, shared references, round trip, corrupt/missing bytes and rollback |
| Template / exports | Native prefixes/header/footer, sentinel old-answer exclusion, column mapping, colors, editable Excel, long PDF pagination; inspect actual artifacts |
| Documentation | Read referenced files, verify relative links/path names, review scope consistency, `git diff --check` |

The dated QA record reports **38 passing tests** and browser/artifact checks from the prior delivery. It explicitly did not run local install/build/lint. Do not reuse that count as a fresh result for changed code.

## 8. Environment and resources

No application environment variables, AI key, login, or backend database are required for the current workflow. Hosting configuration and any future integrations should be verified before changing this statement.

Use existing user-space Node/Python or the Codex bundled document runtime. The last implementation used cloud compilation because local disk/RAM were constrained; re-measure resource values rather than treating old readings as current. Native Windows paths and quoted OneDrive arguments are required.

Original examples and the brand manual are supplied outside the Git checkout in its parent workspace. They are confidential input material, not fixtures to copy into Git or publish. The existing public brand asset/fonts/licenses are the checked-in resources.

## 9. Known gaps and intentional limits

- The UI is notebook-only, with a 1080px minimum workbench; three pane widths are adjustable.
- Evidence highlighting uses PDF. DOCX TOR displays extracted clause text and offers the original download; it does not emulate Word pagination.
- Rotated evidence-page annotation export is rejected. Preserve the visible error until rotation-aware geometry is implemented and verified.
- Deterministic rules cover known vocabulary and conditions, not every TOR sentence. Unsupported/ambiguous proof needs review; AI integration remains a future decision.
- Template import is not a general-purpose Office/PDF converter: native DOCX uses the selected table; XLSX uses the first worksheet structure; PDF uses first-page geometry/style. Complex/scanned layouts may require manual mapping.
- `validateProfile` currently requires the TOR and proposal fields, with 2–12 columns. A submission template should also retain comparison/reference columns from the approved scope; do not assume the validator guarantees every output field.
- Single files are limited to 40 MB in the UI, and archive originals to 160 MB. The maximum-size archive has not been load-tested.
- Clearing site storage can delete local projects. The portable archive is the transfer/backup mechanism.
- There is no tracked dependency lockfile at this revision. A cloud build success does not establish reproducibility for all future dependency resolution.
- Synthetic QA projects and downloaded artifacts may remain in the test browser/Downloads. They are not production/customer examples.

## 10. Continuing work

Load only the landmarks needed for the task after this handoff. Keep approved behavior in the scope document, architecture/status in this file, and dated observations in a QA record. A new user decision changes the relevant source of truth; it does not require duplicating the whole interview across documents.

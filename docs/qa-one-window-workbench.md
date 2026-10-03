# One-window workbench QA

Status: scoped workbench acceptance passed. Updated: 2026-10-03, Asia/Bangkok. Verified implementation: bcc8705; baseline: 40faa7f. Scope: [one-window design](one-window-workbench-design.md), existing local-project TOR rules/review/export boundaries. Chronological observations below retain the intermediate failures and fixes.

## Evidence so far

- Read the approved scope, current code and the supplied local Example TOR collection. Inspected representative Internet/connectivity DOCX tables, multi-sheet network XLSX and highlighted extracted datasheet; locally rendered one Comply and one datasheet page. Real source files remain outside Git/Figma.
- Built five native editable Figma views with local variables/styles/components and linked task tabs. Visually inspected the main composition and the template state in the ordinary browser. Source/proof page numbers and shared clause annotation are explicit. More state visual checks remain pending.
- Figma Starter MCP quota now rejects API calls. No upgrade, external capture-script injection or customer-file upload occurred. Continue normal Free Plan browser review; do not represent unavailable get_design_context as a successful response.
- Added a keyboard-navigable inline task dock, visited-panel draft retention, compact resource/source tools, shared TOR region selection for repair and separate physical/printed reference labels. Optional AI settings use the dock in the project route; Home retains its existing setup dialog.
- Fresh serial business-model suite: `node --test --test-concurrency=1 --test-reporter=spec web/tests/*.test.mjs`, **197 passed, 0 failed, 0 skipped**. Source JSX/module parse and `git diff --check` passed. These tests establish the preserved model boundaries, not the new UI journeys.

## Acceptance gates (completed by the final observations below)

1. Existing completed project still opens with table/TOR/proof together; selecting each row navigates both viewers.
2. Every task tab and rail action stays in the workbench. Table/document headings and original canvases remain visible while editing files/templates/settings/AI.
3. Draft source/answer/resource values survive tool switching; keyboard tab navigation and expand/collapse remain usable.
4. Compact source reading targets the explicit physical page, local OCR/cancellation remains reachable, and repaired region acceptance is blocked on another displayed page.
5. Product/service/file CRUD, association and Undo still invalidate/recover shared results correctly.
6. Three table formats, annotated evidence and portable archive remain reachable with the existing review gates.
7. Inspect the Figma correction/files/settings states and a prototype tab transition under the Free Plan; repair any observed overlap through supported Free Plan UI if needed.
8. Record current cloud build/deployment, actual screenshots and any unverified boundary before final handoff. Preserve the unrelated root README change.

## Current browser observations

Code `1a78ba5` reached production READY in deployment `dpl_CPV9sPgCGxAxnTXShDD1vnFbExuH`. Existing synthetic project `cf318f3d-91d7-4e8e-b64e-22c3abf8a83b` retained both Comply rows and its shared reviewed proof. At 1366×900, each work surface was 709px tall (table 504px, TOR 378px, proof 378px); the file tool opened beneath the table with zero dialogs.

Actual draft probes passed: source transcription, new offering name and template heading survive switching tools. The compact source tool kept exactly two document canvases. AI settings open in the dock with empty credentials. ArrowRight selects TOR, End selects AI and Home returns to the answer tab.

Visual observation found the new manage-offerings button sharing a line with the bidder-scope checkbox. Added a block layout for these controls. Removed duplicate status/download messages inside tool panels, and keyed the project client by project ID so retained tool drafts cannot transfer across project routes. These follow-ups require the next cloud revision/UI check.

Figma Free browser review verified the template view. The source-correction warning overlapped the confirmation line; changed that single text layer to Auto height through the ordinary Figma UI (node 9:945, state confirmed). API quota remains exhausted; no paid upgrade used.

Compact source-page tools now also require their physical target page to be displayed before adding a transcription or confirming whole-page coverage. Reading/"show page" remains available to align the center viewer; a retained draft cannot be attached or completed while inspecting another page. This preserves the old separate-preview safety boundary after removing that duplicated canvas.

On code `f308aeb`, actual two-page repair blocked review/acceptance when target 1 was displayed as page 2. The center source-region read returned `5.1 Support IPv6 and MPLS`; accepted a reviewed punctuation correction, observed 3 Comply/1 pending, and Undo restored all four. Clause 5.4 opened source page 2 with two proof points; selecting its service proof changed the document to qa-service.pdf while source page 2 remained.

The Thai scan page-completion probe was enabled on its reviewed target page, then disabled both confirmation and transcription addition while the center viewer showed another page; the draft remained intact. Local OCR cancellation retained a seeded draft and returned controls to ready. A subsequent local OCR succeeded with no dialog/key and reproduced the known IPv6→โบง6 misreading; source text still requires human correction/review.

Figma Free prototype navigation was exercised at 1366×900: Settings → Files → TOR → Template → Answer, with actual destination node IDs confirmed. All five states were visually inspected. Two multiline text layers were repaired with Auto height using the ordinary Free editor; no upgrade. The captured main prototype is stored under ignored work/figma-one-window-prototype.jpg.

Added source-specific region-selection copy after observing the center TOR caption misleadingly refer to proof binding. Added visible evidence role/manual item associations above the proof viewer: the real datasheet sample contains several model rows, so the expected product/service grouping must be available beside the selected text. These associations describe Presales metadata and do not certify a datasheet's model/spec claims. Final build, outputs and context-caption checks remain next.

Latest code `bad0db4` reached READY in `dpl_DSvun1X7dch9BPpMBCnfGTckdjEy`; fresh final serial suite still passed 197/197. Current browser verified the visible manual association and source-specific crop instruction. It received the real app-generated PDF (8,669 B), DOCX (10,012 B), XLSX (5,917 B), marked proof (30,907 B) and complete archive (59,592 B) from their visible links; current app console error log was empty. Artifact inspection/restore remain pending.

Short-height regression reproduced at 1366×768 after expanding the dock: dock bottom 785.5px exceeded its parent pane bottom 738.5px. Made the dock shrinkable with a lower minimum, compacted short-height chrome and reserved document-viewer space while allowing citation controls to scroll. The role/association caption no longer shrinks away. Verify normal/expanded 1366×768 and 1280×720 after this follow-up build.

## Final verification — 2026-10-03

- Production code `bcc8705` is READY in `dpl_Svv3PUAQ3jzUVyTud1gyaRHiRCxu`, assigned to https://web-ten-teal-31.vercel.app. No local dependency installation was required.
- Normal and expanded dock at 1366×768 ended at 737.70px inside the pane's 738.50px boundary. Normal and expanded 1280×720 ended at 689.70px inside 690.50px; source/proof viewers retained 430.40px/140.76px. The original short-height clipping symptom is resolved. Final 1366×900 screenshot: ignored `work/one-window-app-verified.jpg`.
- Fresh `node --test --test-concurrency=1 --test-reporter=spec web/tests/*.test.mjs`: **197 passed, 0 failed, 0 skipped**. `git diff --check` passed. Actual tool, page, review, Undo, output and restoration journeys supplement these pure-model regressions.
- `work/inspect_ux_outputs.py` passed against received app outputs: one-page PDF with both clauses and 24/48-port text; DOCX with three rows/four columns; XLSX with three rows/four columns, filter A1:D3 and no formula cells; marked proof with shared `6.1, 6.2` label. Archive contains two original files, reviewed rows/shared proof, separate raw/accepted source readings, valid SHA-256 hashes and no credentials.
- Imported the received `ux-complete.torproj` through Home's actual file chooser. Restored project `9f4de18c-b53e-4765-8b76-238a9eb1d23e` opens with two Comply rows and the original source/proof images. Re-exported it through the visible download link. `work/verify_ux_roundtrip.py` passed: new project/file IDs, byte-identical originals, preserved reviews/shared links and reading/completion history. The original project remains present. Current app console error log was empty.
- Figma uses one page for all five editable states and the local component board. Normal Free editor/prototype navigation was used after MCP quota exhaustion. The five states and tab transitions were inspected, with two text overlaps repaired. No upgrade, canvas reset or customer-document upload occurred.

## Delivery boundaries

- A local `.fig` backup was not obtained: after the browser extension reconnected as browser 4, binding the existing editor repeatedly failed on focus emulation. The previously saved editable Figma file/prototype is the deliverable; do not claim an exported local copy. One-page construction avoids the need to reset or reassemble the canvas.
- Figma MCP limits are tied to plan/seat and daily/monthly calls, not canvas size, per [official access/rate-limit documentation](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/) checked 2026-10-03. Resetting a canvas is not a documented quota reset. Ordinary browser editing remains the chosen Free Plan fallback when connected.
- OCR accuracy is not guaranteed; the observed Thai technical-token misreading requires human correction. Native Word pagination, native Excel visual rendering, maximum-size archives/large native Blob downloads and full offline startup are unverified. The redesign does not change optional provider health or establish new live API results.

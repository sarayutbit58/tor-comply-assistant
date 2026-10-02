# One-window workbench QA

Status: implementation in progress; acceptance unproven. Date: 2026-10-02, Asia/Bangkok. Baseline code/docs HEAD: 40faa7f. Scope: [one-window design](one-window-workbench-design.md), existing local-project TOR rules/review/export boundaries.

## Evidence so far

- Read the approved scope, current code and the supplied local Example TOR collection. Inspected representative Internet/connectivity DOCX tables, multi-sheet network XLSX and highlighted extracted datasheet; locally rendered one Comply and one datasheet page. Real source files remain outside Git/Figma.
- Built five native editable Figma views with local variables/styles/components and linked task tabs. Visually inspected the main composition and the template state in the ordinary browser. Source/proof page numbers and shared clause annotation are explicit. More state visual checks remain pending.
- Figma Starter MCP quota now rejects API calls. No upgrade, external capture-script injection or customer-file upload occurred. Continue normal Free Plan browser review; do not represent unavailable get_design_context as a successful response.
- Added a keyboard-navigable inline task dock, visited-panel draft retention, compact resource/source tools, shared TOR region selection for repair and separate physical/printed reference labels. Optional AI settings use the dock in the project route; Home retains its existing setup dialog.
- Fresh serial business-model suite: `node --test --test-concurrency=1 --test-reporter=spec web/tests/*.test.mjs`, **197 passed, 0 failed, 0 skipped**. Source JSX/module parse and `git diff --check` passed. These tests establish the preserved model boundaries, not the new UI journeys.

## Required current browser gates

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

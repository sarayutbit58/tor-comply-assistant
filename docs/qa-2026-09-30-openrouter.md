# QA — OpenRouter LLM/OCR

Date: 2026-09-30, Asia/Bangkok. Baseline: 21e1101. Target: Vercel project web / https://web-ten-teal-31.vercel.app.
Browser-tested code: 8f1e167. Instrument: Codex IAB. Fixtures: existing synthetic QA One-file DOCX and two-page-scan.pdf; no customer documents.
Authorization: add OpenRouter keys for LLM/OCR; user supplied a temporary testing key. Values are not recorded here or in fixtures.

## Coverage map

| Boundary | Probe | Result |
|---|---|---|
| Public metadata | Fetched current public catalogue; five curated families declare text/vision/structured outputs | Inspected on 2026-09-30 |
| Credential validation | Key endpoint before public models; failed key stops catalogue lookup; account/key metadata discarded | Node passed |
| Capabilities | Text-only model excluded from OCR; missing structured output excluded from draft; server rechecks catalogue | Node passed |
| Provider session | Independent vault/provider generation; fresh model lists; LLM/OCR selectors and captured ticket before preflight | Node passed |
| Chat adapter | Strict JSON schema, required parameters, image_url, fixed endpoints, no cache, no alternate model/fallback | Node passed |
| Error/grounding | Length/non-stop output, fake citation and HTTP 200 embedded errors refused; 402 billing sanitized | Node passed |
| Existing regressions | node --test --test-reporter=spec tests/*.test.mjs | 79 passed; zero failures |
| Cloud build | Production alias resolves to 8f1e167 deployment in READY state | Passed |
| Live key/catalogue | Submitted temporary user key; selected LLM/OCR providers while model validation was running | Completed to ready; five current models, easy default, no stuck checking |
| Live LLM | google/gemini-3.5-flash-lite; synthetic IPv6 clause plus one eligible PDF excerpt | Conditions and Thai draft returned with exact source citation; original verdict unchanged |
| Human application | Review checkbox required; applying grounded draft | Saved proposal while keeping pending status |
| Live OCR | Same default model; image-only physical PDF page 2 | Returned ข้อ 6.1 ให้บริการ NOC, visually matching source; stored clause 6.1 on physical page 2, unreviewed/pending |
| Independent selectors | LLM retained OpenRouter while OCR temporarily selected OpenAI, then restored | DOM selections independent; no automatic provider switching |
| Project transfer | tor-project (5).torproj exported while OpenRouter connected; three originals retained | No OpenRouter key prefix or provider/session settings in manifest/archive; grounded proposal retained, pending retained |
| Key lifecycle | Typed but unsubmitted key, clear-all and reload | Empty key field, no model choices/consent; defaults reset after reload |
| Browser console | Final checked state returned zero captured errors | Inspected; not all-session/performance coverage |

## Limits / environment

Review reproduced a connection-state race: switching the selected work provider during model listing aborted that listing and left checking stuck. A failing delayed-list regression confirmed it. Work cancellation now invalidates/aborts inference separately from credential/model-list connections, preserving both stale-result rejection and normal key validation.

Final source parser and git diff --check passed. No local dependency install/build/lint; cloud compilation was used. Bundled Python/zipfile inspected the actual archive. Real and synthetic OpenRouter keys were cleared from the app after verification. No key values appear in this report or fixtures.

Initial disk free 6.90 GB, memory free 1.03 GB. No dependency tree, model, browser binary or admin tool installed. Small Node checks and cloud build are the host-compatible gates.

Catalogue capabilities and key authentication do not establish inference credit or every endpoint's availability. Tier labels and synthetic tests do not establish accuracy on arbitrary Thai TORs. Keys remain in per-tab encrypted memory, with the existing XSS/extension and provider-retention limitations. No customer files used for model testing.

Only the default model was exercised with live LLM/OCR. Alternate models, OCR evidence crops, load capacity and large arbitrary Thai tables were not separately exercised in this browser run; payload/capability guards were checked with Node fixtures. The existing OCR page control appears only while pages remain unreadable; completed clauses can be edited/reviewed, and no repeated-page OCR feature was added.

# QA — OpenRouter LLM/OCR

Date: 2026-09-30, Asia/Bangkok. Baseline: 21e1101. Target: Vercel project web / https://web-ten-teal-31.vercel.app.
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
| Existing regressions | Prior OpenAI/TypeSafe/intake/rules/exports tests | Full run recorded at delivery |
| Cloud build | Next.js on Vercel | Pending |
| Browser and live OpenRouter | Current UI, actual key/models/draft/OCR | Pending |

## Limits / environment

Review reproduced a connection-state race: switching the selected work provider during model listing aborted that listing and left checking stuck. A failing delayed-list regression confirmed it. Work cancellation now invalidates/aborts inference separately from credential/model-list connections, preserving both stale-result rejection and normal key validation.

Initial disk free 6.90 GB, memory free 1.03 GB. No dependency tree, model, browser binary or admin tool installed. Small Node checks and cloud build are the host-compatible gates.

Catalogue capabilities and key authentication do not establish inference credit or every endpoint's availability. Tier labels and synthetic tests do not establish accuracy on arbitrary Thai TORs. Keys remain in per-tab encrypted memory, with the existing XSS/extension and provider-retention limitations. No customer files used for model testing.

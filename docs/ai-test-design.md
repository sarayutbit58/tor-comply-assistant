# API AI test phase — 2026-09-30

User authorization: add OpenAI OCR/LLM and TypeSafe System One, with user-supplied keys per browser tab. Context: session 01a0f0d7-4994-7c12-b65b-b46a432de5b7.

## Execution plan

1. Test and implement a memory-only AES-GCM credential vault; clear on pagehide, reconnect, reload, and disconnect; invalidate outstanding work.
2. Add a stateless same-origin JSON relay with fixed provider endpoints, bounded inputs, no-store, timeout, redacted errors, and no environment credentials or logs.
3. Refresh provider model lists after every key submission. Recommend at most five available verified OpenAI text/vision models; choose an easy model by default. Show TypeSafe's returned stable Jev alias without a picker.
4. Add tab-level settings and explicit clause assistance. OpenAI produces quoted source conditions and cited draft text; TypeSafe ranks and checks known candidates. Programming owns quantities, units, file eligibility, highlights and verdict/review/export gates.
5. Replace the OCR recognizer with selected OpenAI vision OCR, preserving original crop/page coordinates and human review. Comply-table intake remains text-readable; OCR does not manufacture table geometry.
6. Verify Node regressions, mocked provider contracts, late/cancelled responses, browser key entry/reload and original export flow; cloud build on Vercel. Record actual live-provider coverage separately.

## Security and data contract

Credentials never enter projectStore, cookies, localStorage, sessionStorage, IndexedDB, archives, URLs, analytics, or logs. Ciphertext and a nonextractable random CryptoKey remain only in the current tab's memory. Plaintext exists transiently for user input and authorized HTTPS requests. The server processes each supplied key only for that request; no credential database, server session, or cross-request cache.

pagehide clears credentials and aborts outstanding requests, including BFCache navigation. A new tab or reload requires reconnecting. The application cannot guarantee erasing JavaScript strings, OS memory snapshots, malicious extensions, or XSS access; encryption is not a claim of hack-proof operation. Provider data retention is separate from browser storage. OpenAI inference uses store:false.

Model-list success checks authentication/listing access, not inference quota. The five maintained recommendations are gpt-6-luna (easy default), gpt-5.6-luna (easy fallback), gpt-6.1-sol (medium), gpt-6-sol (medium fallback), gpt-6-astra (hard, explicit selection). Filter against the freshly returned list; fewer than five is valid. Tier labels are engineering guidance, not measured Thai TOR accuracy. No automatic paid retry or escalation.

AI never sees TOR/template answers as evidence. Only currently selected offerings' eligible excerpts are sent. Returned quote IDs/text must match those excerpts; box coordinates remain code-owned. AI output is a proposal for human review and cannot overwrite a numeric failure or automatically establish a new Comply result.

## Official contracts checked on 2026-09-30

- [OpenAI models](https://developers.openai.com/api/docs/models), [models list](https://developers.openai.com/api/reference/resources/models/methods/list), [vision](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [data controls](https://developers.openai.com/api/docs/guides/your-data).
- [GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol), [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna): text/image input and structured output support.
- [TypeSafe API](https://docs.typesafe.ai/api), [models](https://docs.typesafe.ai/models), [citation checks](https://docs.typesafe.ai/cookbooks/citation_check), [reranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe). GET /v1/models returns models with name; POST /v1/systemone returns model, answers and usage.
- [OpenAI current error codes](https://developers.openai.com/api/docs/guides/error-codes), [429 troubleshooting](https://help.openai.com/en/articles/5955604-troubleshooting-api-rate-limits-and-429-errors): read the specific public error code; credit/spend/usage exhaustion is not corrected by retrying.

## OpenRouter extension — 2026-09-30

Add an independent encrypted OpenRouter key and LLM/OCR provider selectors to the existing ephemeral session. Authenticate through GET /api/v1/key, discard account/key details, then refresh GET /api/v1/models. Inference rechecks the selected curated model's catalogue capabilities before POST /api/v1/chat/completions. OCR uses image_url data URLs; draft uses response_format JSON Schema with strict:true and require_parameters:true. Output retains exact-source validation and human review.

Curated five families checked against the public catalogue: google/gemini-3.5-flash-lite, openai/gpt-6-luna, google/gemini-3.8-flash, anthropic/claude-sonnet-5.5, anthropic/claude-opus-5.5. Tier labels are engineering starting points, not a Thai OCR/TOR accuracy benchmark. Missing/changed capability yields fewer choices or an explicit refusal; no paid retries or alternate-model escalation. Same-model provider fallback is disabled and data_collection is deny; a lack of eligible endpoints stays a visible provider error.

References: [current-key authentication](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [models](https://openrouter.ai/docs/api/api-reference/models/get-models), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [chat completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request).

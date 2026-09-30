# Agent instructions — TOR Comply Assistant

## Start here

1. Read [CONTEXT.md](CONTEXT.md) before changing this repository. Check `git status --short --branch` and inspect the files relevant to the task; preserve unrelated user changes.
2. **Product behavior:** read [docs/enhancement-scope.md](docs/enhancement-scope.md) before changing workflows, compliance rules, file roles, review gates, templates, or exports. It records the approved decisions. A newer direct user instruction takes precedence; update the affected decision when it changes.
3. **Debugging:** read the available `auditing-debugging-applications` skill before investigation, and use `systematic-debugging` for defects. Read [docs/qa-2026-09-29.md](docs/qa-2026-09-29.md) for previous regressions and tested boundaries. Historical QA is evidence for its recorded revision, not proof for new changes.

## Implementation guardrails

4. Keep this a notebook React/Next.js app with project data in the browser. Paid AI, cloud document storage, authentication, cross-device sync, and mobile layouts require a new user request.
5. Keep state mutations in `web/src/store/projectStore.js` and domain decisions in the pure model/rule modules. Use the existing helpers for evidence links, selected offerings, review gates, and export rows; UI labels alone must not enforce integrity.
6. Treat `products` as the collection of both products and services. A clause may select several offerings that are used together. Evidence is shared through `requirementIds`; unlinking one clause must preserve the other links.
7. Search only explicitly designated evidence documents. TOR text and old Comply-table answers must never enter the evidence index or prove their own compliance.
8. Preserve the review gates and invalidation paths when requirements, selections, responses, evidence, or source files change. A pass must remain traceable to the selected offerings and actual cited text.
9. Preserve persisted projects. The existing storage key intentionally still contains `v2` while the schema is version 3. Use migrations; changing keys or clearing storage is not a migration.
10. Keep binary files in IndexedDB through `localFiles.js`. Use dynamic imports for PDF/OCR/Office/archive libraries at the point of use. Preserve error handling and worker/document cleanup.
11. Preserve the single-template/three-export workflow. Keep Excel editable and filterable, preserve native DOCX structure where supported, and expose cross-format limitations in the preview. Source templates contribute layout, not old answers.

## Work and delivery

12. Use Thai for user-facing communication and app copy. Follow the repository's English identifiers and commit style. Commercial specifications, prices, and capabilities need evidence; label synthetic test content clearly.
13. Keep customer TORs, contracts, pricelists, credentials, browser data, and generated archives out of Git. Use synthetic documents for browser QA. Reading a local example does not authorize uploading it to an external service.
14. Respect the user's constrained Windows host: user-space Node/Python only; no admin, Docker/WSL, local LLMs, or heavy toolchains. Before heavy jobs re-check disk/RAM; require more than 15 GB free before large downloads. Quote OneDrive paths, use `python` rather than `python3`, and avoid privileged symlinks/worktrees and paths over 260 characters. Use at most one subagent, only when delegation is authorized or required by an applicable skill.
15. Use a short plan for multi-step work, make focused changes, and complete already-authorized work. Ask for information only when it changes the next action; do not reopen approved product decisions merely because they are complex.
16. Choose the narrow verification relevant to the change from [CONTEXT.md](CONTEXT.md#7-verification-and-execution). For docs-only work, check links, paths, consistency, and the diff. For behavior changes, reproduce the changed path and report exact commands/results. Do not claim unrun checks or continue optional testing after the concrete risk is resolved.
17. For authorized Git publishing, target this repository and its `main` branch; the production Vercel project is `web`. Verify remote state and deployment results when deployment is part of the task. Do not install a large local dependency tree just to reproduce a cloud build on this host.
18. When architecture, storage, verification, or product scope changes, update the relevant section of `CONTEXT.md` and append a concise dated handoff entry. Keep historical QA records intact and add a new record for a new audit.

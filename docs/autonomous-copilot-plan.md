# Keyless Auto Comply TOR Copilot — implementation and acceptance

Date: 2026-09-30. Baseline/checkpoint: [checkpoint record](checkpoint-2026-09-30.md).
Authorization: user delegated enhancement design and implementation with keyless complete-loop and one-page workbench requirements.

## Scope and success criteria

The existing React/Next.js app remains a local-project Presales TOR Copilot. No new authentication, shared cloud document library, cross-device sync, local LLM, or mobile scope. Internet hosting/runtime resources are distinct from an API key: keyless is required; offline startup is not claimed.

Success requires all of these to be implemented and evidenced:

1. Recoverable source checkpoint and preserved unrelated local changes.
2. Keyless text/Office/manual/scanned workflows, including local OCR or manual transcription and explicit source-page resolution.
3. Reading quality flags and source repair preview preserving raw extraction, page/region, before/after text and acceptance provenance; critical differences never silently replace a clause.
4. Geometry-aware reading and improved Office extraction without using old proposal/status/reference columns as evidence.
5. Workbench add/edit/remove for clauses, offerings, file associations and evidence; validation/invalidation covers shared references. Originals retained wherever still referenced.
6. Local background Copilot/readiness/batch assistance with progress, cancellation and stale-input guards. Human offering choices and review/export gates remain.
7. Usable default template, PDF/DOCX/XLSX outputs, annotated evidence and portable project round trip from a project completed with no keys.
8. Optional AI remains opt-in and failures/disconnection do not disable local/manual work.
9. Use cases, scenario regressions, browser journeys/artifact inspection, updated Markdown and verified deployment. Every completion claim maps to fresh authoritative evidence.

## Execution sequence

1. Checkpoint and baseline audit. Confirmed gaps: API-only OCR, no manual source-page completion, readonly evidence quotes, missing resource editing and unvalidated evidence updates.
2. Add pure reading-quality/geometry/provenance helpers and regressions for reordered items, critical-token differences, Thai glyphs and swallowed clause boundaries.
3. Restore local OCR default and manual correction/transcription, including explicit source review policy and page resolution. Source repair is a draft until accepted.
4. Centralize validated domain mutations, resource metadata reassignment, evidence quote/page editing, shared invalidation and reversible metadata changes.
5. Add workbench toolbars, task/readiness Copilot, deterministic batch suggestions and cancellation. Keep all work on the project route.
6. Exercise keyless browser journeys, exports/archives, error recovery and optional-AI regressions; audit each criterion before marking the goal complete.

Implementation keeps pure decisions in lib/*.mjs and browser adapters/UI separate. Tests are written before behavior changes and observed failing; no large dependency installation on this host. Cloud compilation is the existing build alternative.

## Scenario/use-case matrix

| ID | Presales scenario | Required result / verification |
|---|---|---|
| U01 | Start with a filled Comply table | Selected number/TOR columns plus layout; old answers excluded; fresh pending rows |
| U02 | Text PDF has minimum, maximum, negation, 24/48 ports and 10G/25G | Critical changes flagged in comparison; numeric semantics preserved; no silent correction/pass |
| U03 | Shuffled glyph stream, Thai accents, split technical tokens | Stable visual order; source raw text retained; uncertain glyphs surfaced |
| U04 | Columns, headers, repeated table headings and page continuation | Correct clause/source identity; no cross-column proof or swallowed clause |
| U05 | DOCX list numbering/nested tables and sparse/merged XLSX | Visible source identity and warnings; requirements not mixed with old answers |
| U06 | Scan TOR with no key | Local OCR or manual page transcription; explicit page completion; clauses stay unreviewed until confirmed |
| U07 | Scan/garbled evidence with no key | Physical region + editable transcription + explicit source review; pass/export blocked until review |
| U08 | Accept/reject a repaired TOR reading | Before/after/image retained; rejection changes nothing; acceptance invalidates old assessment/verdict |
| U09 | Renumber, add, edit, delete and restore a clause | Rows/shared links consistent; export uses current clauses |
| U10 | Edit brand/model/service or file role/associations | Original blobs retained; dependent verdicts invalidated; no forbidden evidence |
| U11 | One mark supports two clauses, then edit/unlink/delete | Single unlink preserves other; global edit invalidates both; invalid box/page/doc update rejected |
| U12 | Run/cancel local project-wide suggestions | Ready clauses processed sequentially; skips explained; no paid requests; stale results not applied |
| U13 | Optional provider absent, disconnected, failed or changed | Local/manual loop stays usable; cloud work remains explicit and obsolete result discarded |
| U14 | Export and restore a completed keyless project | Three table formats + marked proof + all originals/provenance; new project IDs; no credentials |
| U15 | Empty/manual-only project and blank/no-requirement source page | Usable default template; explicit page-resolution reason; no invented requirements |
| U16 | Storage/file missing or malformed/oversized input | Visible actionable failure; no silent successful save or dangling pass |

## Current evidence/progress

- Checkpoint created; root README diff preserved in ignored scratch directory.
- Baseline source audited; historical 79-test result is not a fresh result for this enhancement.
- No completed implementation criteria or new browser gates claimed yet.

## Completion audit

Maintain a dated QA record linking each criterion/Uxx to unit output, actual browser behavior or exported artifact. Untested, indirect or weak evidence means incomplete. Accuracy on arbitrary future TORs and absence of all future bugs cannot be guaranteed; preserve explicit limitations.

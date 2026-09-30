# Checkpoint before autonomous Copilot enhancement

Date: 2026-09-30, Asia/Bangkok.
Committed source: 407f017552c8c655f3d22aaf3048e02c06030ebb.
Annotated Git tag: checkpoint/copilot-2026-09-30, resolving to that source revision.

The working tree also had a pre-existing README.md modification from another task. It is preserved in place and copied to ignored work/checkpoint-2026-09-30-copilot/README.pre-existing.patch. That private scratch patch is separate from the committed checkpoint; no customer documents or keys are copied into Git.

## User decisions carried forward

- Keep the product an Auto Comply TOR Copilot for Presales, notebook-only.
- Complete a project without API credentials. Code and manual review are the foundation; LLM/System One are optional, explicit supplements.
- Maximize add/edit/remove/correction tools inside the project workbench.
- Priority: intake/correction, evidence/highlights, then final readiness/export. Within intake: extraction correction, clause structure, then condition decomposition.
- Source priority: text-readable PDFs, DOCX/XLSX, then scans. Text-PDF error priority: missing/changed critical values/units/negation, Thai glyph problems, then reading order.
- Corrections are suggestions with source image and before/after text. Presales accepts before replacement; prior verdicts are invalidated.
- The user delegated remaining design choices and requested multiple use cases/scenarios and verification; further product interviews are not required for these authorized decisions.

The enhancement plan and completion audit live in [autonomous-copilot-plan.md](autonomous-copilot-plan.md). A regression suite reduces risk; it cannot guarantee that future software changes never introduce bugs.

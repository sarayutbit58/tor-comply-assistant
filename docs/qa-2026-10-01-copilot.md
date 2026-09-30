# Keyless Copilot QA continuation — 2026-10-01

Continues [the initial QA record](qa-2026-09-30-copilot.md). Status: in progress; active goal remains open until actual artifacts/restore and remaining UI gates pass.

## Fresh browser evidence

Synthetic scan project `86063ad6-886b-4e8c-b0cc-dad2f41e686f`:

- Raster-only TOR and proof PDFs had empty text layers and no prior annotations.
- Local OCR returned the two source clauses and, from a selected proof region, `IPv6 supported` / `48 ports`, with no key or cloud consent.
- Unsaved transcription blocked page completion. Added clauses remained unreviewed; reviewed both against the image and explicitly completed the page with a recorded reason.
- Selected a manually labelled QA product for both clauses, confirmed one physical proof region and shared it across 6.1/6.2. Code Auto produced two Comply rows after all source checks.
- Tested the workbench at 1366×900: table, TOR and proof remained simultaneously visible.
- The generated PDF link was present and emitted `Page.downloadWillBegin`, but the in-app download adapter did not return a saved file; no saved-artifact claim is based on that event alone.

## Corrections and next gates

- Small files (up to 1 MiB) gain a binary-only self-contained link; larger files retain Blob URLs. Cancelled encoders cannot replace later downloads; URLs/readers expire or release on replacement/close. Actual decoded artifacts are the next verification gate.
- Archive validation covers malformed labels, profiles and native-layout metadata while preserving legacy optional fields.
- Native Word routing retains valid layouts; legacy profiles without native structure use their known normalized profile with a visible template notice. Office source-row labels now keep their actual one-based row number.
- Stored page reading history is visible from source tools. Evidence viewer captions describe an original document during readonly/busy states.

Pending: inspect PDF/DOCX/XLSX/marked proof bytes/rendering, restore the complete archive, actual Office numbering/merged-row warnings, remaining CRUD/source-repair/error-recovery browser scenarios and final requirement-by-requirement audit. Future arbitrary TOR accuracy and zero future bugs are not claimed.

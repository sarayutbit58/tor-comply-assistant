# One-window TOR workbench

User objective: enhance the Figma UX/UI and make project work available in one window, using the supplied Example TOR collection as design evidence. Figma Free Plan only.

## Design authority and examples

The approved product scope remains [enhancement-scope.md](enhancement-scope.md). Representative local inspection found a 69-row/four-column Internet DOCX, a 110-row/five-column connectivity Comply DOCX, and a network XLSX with five clause worksheets. A highlighted extracted datasheet has physical PDF page 2 but printed page 19. These are reading/layout observations, not fresh product-spec or compliance judgments.

Real documents were read/rendered locally. Their customer text/files were not placed in Figma or Git. Figma uses synthetic clauses, filenames and offerings to demonstrate the same patterns.

## Locked view and interaction inventory

- A 1366×900 notebook workbench with a project action bar, readiness, persistent clause table, original TOR and evidence surfaces.
- Selecting a clause navigates both source/proof views using the existing page/mark identities; missing proof remains explicitly unlinked.
- Inline task dock below the table: answer, source intake/correction, products/services/designated files, template/export settings, project settings and optional AI keys. The table and both document surfaces remain visible.
- Visited tool panels stay mounted and hidden so switching tools preserves drafts. Heavy document renderers are not duplicated in the compact source tools. Tools can expand while the clause table retains a minimum visible area.
- Source correction operates on the displayed physical source page; its review/accept buttons remain disabled when that page differs from the correction target. Region selection comes from the original TOR surface.
- Physical PDF and printed page numbers appear separately in evidence references. One proof point may label multiple clauses, with global edits and single-clause unlink retaining existing invalidation semantics.
- Use the existing licensed Noto Sans Thai asset for the workbench. Tahoma was not available to the Figma runtime; no font installation is required. Primary controls use the existing darker brand shade C9002D for readable white labels, while the accent remains FF0038.

## Figma artifact

File: https://www.figma.com/design/WF6dtSgmoLFcnfOfZmy9tF/Untitled

| View | Node |
|---|---|
| Review/answer | 6:37 |
| TOR correction | 9:774 |
| Products/services/files | 9:955 |
| Template/export mapping | 9:1139 |
| Project settings | 9:1320 |

Five editable frames and the component board occupy one page, `TOR Comply — One window`, following the user's Free Plan/one-page decision. They share scoped brand variables, text styles and local control/row components. Last successful structural audit showed 166–169 descendants per frame, 35–36 instances, 88–90 text nodes and zero image-filled nodes; 20 cross-frame tool-tab transitions were created. This is an editable prototype, not a complete-UI raster.

The Starter MCP quota was reached after construction. Further API screenshots/edits and get_design_context are unavailable; ordinary Free Plan browser review remains available. The user has excluded a paid upgrade. A capture ID issued for a baseline web capture was never submitted and created no capture page; no capture output is included.

## Delivery gates

Implementation through `bcc8705` passed the scoped functional/browser gates on 2026-10-03, including short notebook layouts, local OCR/correction safety, shared-proof metadata/Undo, three table outputs, annotated proof and actual portable-project restoration. See [qa-one-window-workbench.md](qa-one-window-workbench.md) for exact evidence and limitations. Figma's saved one-page file is the artifact; no local `.fig` export was received after the browser connection failed. Canvas reset/reassembly is unnecessary, and cannot be relied on to reset the plan/seat MCP quota.

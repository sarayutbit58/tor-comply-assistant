# TOR Comply API — v1 frozen

Source of truth: `v1.openapi.yaml`

## Domain graph
`Project → Requirement[] → ComplyRow` (+ project-scoped `docs`)

| Field | Rule |
| --- | --- |
| `Requirement.id` | Stable TOR section number (`3.1`), not char offsets |
| `Requirement.textSnapshot` | Frozen at upsert; re-import must not rewrite silently |
| `DocRef` | `{ docId, page }` — `docId` is **project-scoped** |
| `ComplyRow.compareText` | Required — Red Cross เปรียบเทียบ column |
| Export | Red Cross 5-col Word (incl. เปรียบเทียบ) |
| AI | No LLM on hot path |

## Maps to Word (Red Cross layout)
1. ลำดับที่ ← `Requirement.id`
2. รายละเอียดการดำเนินงาน ← `title` + `textSnapshot`
3. รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ ← `ComplyRow.bidderText`
4. เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ ← `ComplyRow.compareText`
5. เอกสารอ้างอิง ← refs as `{doc.name} หน้า {page}`

Wire field naming stays English (`bidderText` / `compareText`); Thai lives in the Word headers only.

TS mirror: `web/src/lib/types.ts` (must stay aligned with this OpenAPI).

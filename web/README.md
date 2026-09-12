# TOR Comply Assistant (MVP shell)

Blank-project UI for Thai government TOR compliance tables.

## Flow
1. Create blank project **or** load กพบ demo (42 section IDs)
2. Checklist — search / add section-number requirements
3. Docs — attach project-scoped PDFs (browser storage)
4. Annotate — bidder text + `{docId, page}` refs
5. Export — Red Cross Word: ลำดับที่ / คุณลักษณะตามข้อกำหนด / ของผู้เสนอราคา / เปรียบเทียบ… / เอกสารอ้างอิง

**No LLM** on the hot path.

## Run
```bash
cd web
npm i
npm run dev
```

## Notes
- State persists in `localStorage` (`tor-comply-mvp-v1`)
- Export uses the `docx` package client-side
- Export includes เปรียบเทียบ (`ComplyRow.compareText`) per Red Cross filled layout

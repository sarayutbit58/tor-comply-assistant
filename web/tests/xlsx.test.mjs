import test from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx } from '../src/lib/xlsx.mjs';

test('Excel export writes four columns and keeps formula-like proposal as text', () => {
  const bytes = buildXlsx({
    requirements: [{ id: '5.3', textSnapshot: 'รองรับ IPv6' }],
    rows: { '5.3': { proposal: '=HYPERLINK("https://bad.example","x")', comparison: 'รอตรวจสอบ' } },
    evidence: [{ requirementId: '5.3', docId: 'doc-1', pdfPage: 5, printedPage: '4' }],
    docs: [{ id: 'doc-1', name: 'technical.pdf' }],
  });
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /เอกสารอ้างอิง ไฟล์ใด หน้าใด/u);
  assert.match(text, /t="inlineStr"/u);
  assert.match(text, /=HYPERLINK/u);
  assert.match(text, /หน้า 4 \(PDF 5\)/u);
});

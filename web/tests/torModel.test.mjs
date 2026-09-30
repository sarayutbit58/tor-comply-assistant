import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePages, parseDocxBlocks, uniqueRequirements, reviewComparison, rankDocuments, makeSearchIndex } from '../src/lib/torModel.mjs';

test('TOR clauses keep their first physical PDF page and continuation text', () => {
  const result = parsePages([
    { page: 1, text: '4.15.2 รองรับ IPv6\nสำหรับวงจรหลัก' },
    { page: 2, text: 'พร้อมรายงานรายเดือน\n4.16 บริการ NOC' },
    { page: 3, text: '' },
  ]);
  assert.deepEqual(result.requirements.map(item => item.id), ['4.15.2', '4.16']);
  assert.equal(result.requirements[0].sourcePage, 1);
  assert.match(result.requirements[0].textSnapshot, /พร้อมรายงานรายเดือน/);
  assert.deepEqual(result.unreadablePages, [3]);
});

test('short top-level numbered heading keeps its section number', () => {
  const result = parsePages([{ page: 1, text: '1. วัตถุประสงค์\n1.1 ต้องรองรับ IPv6' }]);
  assert.deepEqual(result.requirements.map(item => item.id), ['1', '1.1']);
});

test('OCR keeps a decimal clause number after a short misread ข้อ prefix', () => {
  const result = parsePages([{ page: 1, text: 'ข้� 5.3 รองรับ IPv6 Addressing' }], 'ocr');
  assert.equal(result.requirements[0].id, '5.3');
});
test('keyless local OCR retains decimal labels under the same short-prefix correction',()=>{
 const result=parsePages([{page:1,text:'ข้� 5.3 รองรับ IPv6 Addressing'}],'local-ocr');assert.equal(result.requirements[0].id,'5.3');assert.equal(result.requirements[0].sourceMethod,'local-ocr');
});

test('DOCX keeps numbered paragraphs and table rows including Thai digits in source order', () => {
  const result = parseDocxBlocks([
    { type: 'paragraph', text: '4.16 บริการ NOC' },
    { type: 'tableRow', cells: ['5.3', 'รองรับ IPv6'] },
    { type: 'tableRow', cells: ['๕.๔', 'รายงานรายเดือน'] },
  ]);
  assert.deepEqual(result.requirements.map(item => item.id), ['4.16', '5.3', '5.4']);
});

test('duplicate TOR numbers preserve both clauses with separate response keys', () => {
  const parsed = parsePages([{ page: 1, text: '5.3 ข้อแรก\n5.3 ข้อสอง' }]);
  assert.deepEqual(parsed.requirements.map(item => item.id), ['5.3', '5.3#2']);
  assert.equal(parsed.requirements[1].duplicateOf, '5.3');
  const added = uniqueRequirements([{ id: '5.3', title: 'ข้อที่สาม', textSnapshot: 'ข้อที่สาม' }], parsed.requirements);
  assert.equal(added[0].id, '5.3#3');
});

test('pass judgment requires a proposal and evidence for the selected product', () => {
  const docs = [{ id: 'doc-a', productId: 'product-a' }];
  const evidence = [{ docId: 'doc-a', requirementId: '5.3' }];
  assert.throws(() => reviewComparison({ proposal: '', comparison: 'ตรงตามข้อกำหนด', productId: 'product-a', evidence, docs }), /รายละเอียดที่เสนอ/);
  assert.throws(() => reviewComparison({ proposal: 'Router B', comparison: 'ตรงตามข้อกำหนด', productId: 'product-b', evidence, docs }), /สินค้า/);
  assert.equal(reviewComparison({ proposal: 'Router A', comparison: 'ตรงตามข้อกำหนด', productId: 'product-a', evidence, docs }), 'ตรงตามข้อกำหนด');
});

test('literal document matches are suggestions, not compliance decisions', () => {
  const ranked = rankDocuments('ต้องรองรับ IPv6 MPLS', [
    { id: 'a', name: 'network.pdf', searchText: 'IPv6 routing MPLS' },
    { id: 'b', name: 'storage.pdf', searchText: 'disk storage' },
  ]);
  assert.equal(ranked[0].id, 'a');
  assert.deepEqual(ranked[0].matchedTerms, ['IPv6', 'MPLS']);
  assert.equal(ranked[0].comparison, undefined);
});

test('document keyword index includes a technical term after long earlier text', () => {
  const index = makeSearchIndex('รายงาน '.repeat(2000) + ' IPv6 Addressing');
  assert.match(index, /IPv6/u);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePages, reviewComparison, rankDocuments, makeSearchIndex } from '../src/lib/torModel.mjs';

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

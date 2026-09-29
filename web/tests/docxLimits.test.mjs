import test from 'node:test';
import assert from 'node:assert/strict';
import { allowDocxEntry } from '../src/lib/docxLimits.mjs';

test('DOCX extraction ignores unrelated large entries and rejects oversized document XML', () => {
  assert.equal(allowDocxEntry({ name: 'word/media/huge.bin', originalSize: 100_000_000 }), false);
  assert.equal(allowDocxEntry({ name: 'word/document.xml', originalSize: 100_000 }), true);
  assert.throws(() => allowDocxEntry({ name: 'word/document.xml', originalSize: 6_000_000 }), /ใหญ่เกินไป/u);
});

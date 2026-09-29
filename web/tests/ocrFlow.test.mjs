import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizePage } from '../src/lib/ocrFlow.mjs';

test('OCR result retains requested page even if selection changes during recognition', async () => {
  let selectedPage = 1;
  const pending = recognizePage(selectedPage, async page => {
    selectedPage = 2;
    return `image-${page}`;
  }, async image => ({ text: image, confidence: 90 }));
  const result = await pending;
  assert.equal(selectedPage, 2);
  assert.equal(result.page, 1);
  assert.equal(result.text, 'image-1');
});

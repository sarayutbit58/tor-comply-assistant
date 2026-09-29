import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceBoxToPdf, splitPdfLabel } from '../src/lib/pdfGeometry.mjs';

test('highlight coordinates use the visible CropBox origin and size', () => {
  const result = evidenceBoxToPdf([0.1, 0.1, 0.2, 0.04], { x: 100, y: 100, width: 400, height: 600 });
  assert.deepEqual(result, { x: 140, y: 616, width: 80, height: 24 });
});

test('Thai and Latin clause labels use fonts that can encode their glyphs', () => {
  assert.deepEqual(splitPdfLabel('๕.๓'), [
    { text: 'ข้อที่', font: 'thai' },
    { text: ' 5.3', font: 'latin' },
  ]);
});

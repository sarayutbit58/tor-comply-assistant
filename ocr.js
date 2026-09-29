// Local OCR helper. Input is one rendered page; no document leaves this machine.
const path = require('path');
const { createWorker } = require(process.env.TOR_TESSERACT_MODULE || 'tesseract.js');

async function main() {
  const image = process.argv[2];
  if (!image) throw new Error('Missing page image');
  const worker = await createWorker(['tha', 'eng'], 1, {
    langPath: path.join(__dirname, 'ocr-data'),
    gzip: false,
    cacheMethod: 'none',
  });
  try {
    const { data } = await worker.recognize(image);
    process.stdout.write(JSON.stringify({ text: data.text || '', confidence: data.confidence || 0 }));
  } finally {
    await worker.terminate();
  }
}

main().catch(error => { process.stderr.write(String(error.stack || error)); process.exitCode = 1; });

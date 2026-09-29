export async function recognizeImage(image) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['tha', 'eng'], 1, {
    langPath: '/ocr-data',
    gzip: false,
  });
  try {
    const result = await worker.recognize(image);
    return { text: result.data.text || '', confidence: result.data.confidence || 0 };
  } finally {
    await worker.terminate();
  }
}

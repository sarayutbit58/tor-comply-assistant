import {reconstructReading} from './readingModel.mjs';
let loadingLibrary;

async function pdfLibrary() {
  if (!loadingLibrary) {
    loadingLibrary = import('pdfjs-dist').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return loadingLibrary;
}

export async function loadPdf(blob) {
  const pdfjs = await pdfLibrary();
  const data = new Uint8Array(await blob.arrayBuffer());
  return pdfjs.getDocument({ data, wasmUrl: '/wasm/' }).promise;
}

export async function pageText(pdf, number) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  return content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
}

export async function extractPdf(blob, maxPages = Infinity) {
  const pdf = await loadPdf(blob);
  try {
    const pages = [];
    for (let number = 1; number <= Math.min(pdf.numPages,maxPages); number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter(item => 'str' in item && item.str.trim()).map(item => {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const h = Math.max(1, item.height || Math.hypot(item.transform[2], item.transform[3]));
        return { text: item.str, box: [Math.max(0, x / viewport.width), Math.max(0, (y - h) / viewport.height), Math.max(.001, Math.min(1 - Math.max(0, x / viewport.width), Math.abs(item.width) / viewport.width)), Math.min(1, h / viewport.height)], end: Boolean(item.hasEOL) };
      });
      const reading=reconstructReading(items);
      pages.push({page:number,text:reading.text,rawText:content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim(),items,lines:reading.lines.map(line=>({text:line.text,box:line.box})),readingIssues:reading.issues});
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

export async function paintPage(pdf, number, canvas, scale = 1.7) {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ไม่สามารถแสดงหน้า PDF');
  await page.render({ canvasContext: context, viewport }).promise;
  return viewport;
}

export async function ocrPdfPage(blob, number) {
  const pdf = await loadPdf(blob);
  try {
    const canvas = document.createElement('canvas');
    await paintPage(pdf, number, canvas, 2.2);
    return canvas.toDataURL('image/png');
  } finally {
    await pdf.destroy();
  }
}

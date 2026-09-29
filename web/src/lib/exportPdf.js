import { getFile } from './localFiles';
import { evidenceBoxToPdf, splitPdfLabel } from './pdfGeometry.mjs';
import { linkedRequirements } from './projectModel.mjs';

export async function exportAnnotatedPdf(project, docId) {
  const entry = await getFile(docId);
  if (!entry) throw new Error('ไม่พบ PDF ต้นฉบับในเบราว์เซอร์นี้');
  const [{ PDFDocument, StandardFonts, rgb }, fontkitModule] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const document = await PDFDocument.load(await entry.blob.arrayBuffer());
  document.registerFontkit(fontkitModule.default || fontkitModule);
  const fontBytes = await fetch('/fonts/NotoSansThai-Regular.ttf').then(response => {
    if (!response.ok) throw new Error('ไม่พบฟอนต์สำหรับเลขข้อบน PDF');
    return response.arrayBuffer();
  });
  const font = await document.embedFont(fontBytes, { subset: true });
  const numberFont = document.embedStandardFont(StandardFonts.Helvetica);
  for (const mark of project.evidence.filter(item => item.docId === docId)) {
    const page = document.getPage(mark.pdfPage - 1);
    if (!page) throw new Error(`ไม่พบหน้า PDF ${mark.pdfPage}`);
    if (page.getRotation().angle !== 0) throw new Error(`หน้า PDF ${mark.pdfPage} หมุนอยู่ จึงยังไม่ทำเครื่องหมายอัตโนมัติ`);
    const numbers = linkedRequirements(mark).filter(id => project.requirements.some(item => item.id === id));
    if (!numbers.length) continue;
    const visiblePage = page.getCropBox();
    const rectangle = evidenceBoxToPdf(mark.box, visiblePage);
    const left = rectangle.x;
    const bottom = rectangle.y;
    const boxHeight = rectangle.height;
    page.drawRectangle({ x: left, y: bottom, width: rectangle.width, height: boxHeight, color: rgb(1, 0.945, 0.46), opacity: 0.48 });
    const labelY = Math.min(visiblePage.y + visiblePage.height - 12, bottom + boxHeight + 3);
    const color = rgb(0.84, 0, 0.19);
    let labelX = left;
    for (const run of splitPdfLabel(numbers.join(', '))) {
      const selectedFont = run.font === 'thai' ? font : numberFont;
      page.drawText(run.text, { x: labelX, y: labelY, size: 9, font: selectedFont, color });
      labelX += selectedFont.widthOfTextAtSize(run.text, 9);
    }
  }
  return new Blob([await document.save()], { type: 'application/pdf' });
}

import { getFile } from './localFiles';

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
    const requirement = project.requirements.find(item => item.id === mark.requirementId);
    if (!requirement) continue;
    const [x, top, width, height] = mark.box;
    const left = x * page.getWidth();
    const bottom = (1 - top - height) * page.getHeight();
    const boxHeight = height * page.getHeight();
    page.drawRectangle({ x: left, y: bottom, width: width * page.getWidth(), height: boxHeight, color: rgb(1, 0.945, 0.46), opacity: 0.48 });
    const labelY = Math.min(page.getHeight() - 12, bottom + boxHeight + 3);
    const color = rgb(0.84, 0, 0.19);
    page.drawText('ข้อที่', { x: left, y: labelY, size: 9, font, color });
    page.drawText(` ${requirement.id}`, { x: left + font.widthOfTextAtSize('ข้อที่', 9) + 2, y: labelY, size: 9, font: numberFont, color });
  }
  return new Blob([await document.save()], { type: 'application/pdf' });
}

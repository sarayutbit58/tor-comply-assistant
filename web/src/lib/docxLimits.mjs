export const MAX_DOCX_XML = 5 * 1024 * 1024;

export function allowDocxEntry(file) {
  if (file.name !== 'word/document.xml') return false;
  if (!Number.isSafeInteger(file.originalSize) || file.originalSize < 0 || file.originalSize > MAX_DOCX_XML) throw new Error('เนื้อหา DOCX ใหญ่เกินไป');
  return true;
}

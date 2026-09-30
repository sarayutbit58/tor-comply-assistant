export const MAX_DOCX_XML = 5 * 1024 * 1024;
export const MAX_DOCX_NUMBERING_XML = 1024 * 1024;

export function allowDocxEntry(file) {
  if (!['word/document.xml','word/numbering.xml'].includes(file.name)) return false;
  const limit = file.name==='word/numbering.xml' ? MAX_DOCX_NUMBERING_XML : MAX_DOCX_XML;
  if (!Number.isSafeInteger(file.originalSize) || file.originalSize < 0 || file.originalSize > limit) throw new Error('เนื้อหา DOCX ใหญ่เกินไป');
  return true;
}

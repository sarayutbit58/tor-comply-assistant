import { parseDocxBlocks } from './torModel.mjs';
import { allowDocxEntry, MAX_DOCX_XML } from './docxLimits.mjs';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function paragraphText(node) {
  return [...node.getElementsByTagNameNS(wordNamespace, 't')].map(item => item.textContent || '').join('');
}

export async function extractDocx(file) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: allowDocxEntry });
  const content = archive['word/document.xml'];
  if (!content) throw new Error('ไฟล์ DOCX ไม่มี word/document.xml');
  if (content.length > MAX_DOCX_XML) throw new Error('เนื้อหา DOCX ใหญ่เกินไป');
  const document = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('อ่านโครงสร้าง DOCX ไม่สำเร็จ');

  const body = document.getElementsByTagNameNS(wordNamespace, 'body')[0];
  if (!body) throw new Error('ไฟล์ DOCX ไม่มีเนื้อหาเอกสาร');
  const blocks = [];
  for (const child of body.childNodes) {
    if (child.nodeType !== 1) continue;
    if (child.localName === 'p') blocks.push({ type: 'paragraph', text: paragraphText(child) });
    if (child.localName === 'tbl') {
      for (const row of child.getElementsByTagNameNS(wordNamespace, 'tr')) {
        const cells = [...row.childNodes].filter(node => node.localName === 'tc');
        blocks.push({ type: 'tableRow', cells: cells.map(cell => [...cell.getElementsByTagNameNS(wordNamespace, 'p')].map(paragraphText).join('\n')) });
      }
    }
  }
  return parseDocxBlocks(blocks);
}

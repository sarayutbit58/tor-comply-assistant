import { parsePages } from './torModel.mjs';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function paragraphText(node) {
  return [...node.getElementsByTagNameNS(wordNamespace, 't')].map(item => item.textContent || '').join('');
}

export async function extractDocx(file) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const content = archive['word/document.xml'];
  if (!content) throw new Error('ไฟล์ DOCX ไม่มี word/document.xml');
  const document = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('อ่านโครงสร้าง DOCX ไม่สำเร็จ');

  const requirements = [];
  for (const row of document.getElementsByTagNameNS(wordNamespace, 'tr')) {
    const cells = [...row.childNodes].filter(node => node.localName === 'tc');
    if (cells.length < 2) continue;
    const number = paragraphText(cells[0]).trim().replace(/[.)]$/u, '');
    const text = [...cells[1].getElementsByTagNameNS(wordNamespace, 'p')].map(paragraphText).join('\n').trim();
    if (/^\d+(?:\.\d+)*$/u.test(number) && text) {
      requirements.push({ id: number, title: text.slice(0, 120), textSnapshot: text, sourcePage: null, sourceMethod: 'text' });
    }
  }
  if (requirements.length) return { requirements, unreadablePages: [] };

  const paragraphs = [...document.getElementsByTagNameNS(wordNamespace, 'p')].map(paragraphText).filter(Boolean);
  return parsePages([{ page: 1, text: paragraphs.join('\n') }]);
}

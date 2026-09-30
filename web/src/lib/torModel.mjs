import {reconstructReading,readingRisks,regionUnion} from './readingModel.mjs';
const headingPattern = /^\s*(?:ข้อ\s*)?([0-9๐-๙]+(?:\.[0-9๐-๙]+)*)(?:[.)])?\s+(.{3,})$/u;
const domainTerms = ['MPLS', 'IPv6', 'IPv4', 'NOC', 'SLA', 'VPN', 'Firewall', 'Switch', 'Router', 'Server', 'Storage', 'วงจร', 'เครือข่าย', 'รายงาน', 'บริการ'];
const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';

export function uniqueRequirements(incoming, existing = []) {
  const used = new Set(existing.map(item => item.id));
  return incoming.map(item => {
    if (!used.has(item.id)) {
      used.add(item.id);
      return item;
    }
    const original = item.duplicateOf || item.id.replace(/#\d+$/u, '');
    let suffix = 2;
    while (used.has(`${original}#${suffix}`)) suffix += 1;
    const id = `${original}#${suffix}`;
    used.add(id);
    return { ...item, id, duplicateOf: original };
  });
}

function sectionNumber(value) {
  return value.replace(/[๐-๙]/gu, digit => String(thaiDigits.indexOf(digit)));
}

function heading(raw) {
  const line = raw.trim().replace(/\s+/gu, ' ');
  const match = headingPattern.exec(line);
  if (!match) return null;
  const explicitMarker = /^(?:ข้อ\s*)?[0-9๐-๙]+[.)]\s/u.test(line);
  if (!match[1].includes('.') && !line.startsWith('ข้อ') && !explicitMarker && line.length < 26) return null;
  return { id: sectionNumber(match[1]), text: match[2] };
}

export function parsePages(pages, sourceMethod = 'text') {
  const requirements = [];
  const unreadablePages = [];
  let current = null;
  let leading = [];
  let leadingPage = null;

  function flushLeading() {
    if (!leading.length) return;
    if (current) current.textSnapshot += '\n' + leading.join('\n');
    else requirements.push({ id: `P${leadingPage}`, title: 'ข้อความก่อนเลขข้อ', textSnapshot: leading.join('\n'), sourcePage: leadingPage, sourceMethod });
    leading = [];
    leadingPage = null;
  }

  for (const page of pages) {
    const rebuilt=page.items?.length?reconstructReading(page.items):null;
    const reading=rebuilt?.text??page.text;
    if (!reading?.trim()) {
      unreadablePages.push(page.page);
      continue;
    }
    const lines=rebuilt?.lines||reading.split(/\r?\n/u).map(text=>({text,box:null}));
    for (const sourceLine of lines) {
      const raw=sourceLine.text;
      const line = sourceMethod === 'ocr'
        ? raw.trim().replace(/^ข[^0-9๐-๙]{0,10}(?=[0-9๐-๙]+(?:\.[0-9๐-๙]+)+\s)/u, '')
        : raw.trim();
      if (!line) continue;
      const found = heading(line);
      if (found) {
        flushLeading();
        if (current) requirements.push(current);
        current = {id:found.id,title:found.text.slice(0,120),textSnapshot:found.text,rawTextSnapshot:found.text,sourcePage:page.page,sourcePages:[page.page],sourceRegions:sourceLine.box?[{page:page.page,box:sourceLine.box}]:[],sourceMethod,readingIssues:readingRisks(found.text)};
      } else if (current) {
        current.textSnapshot += '\n' + line;
        current.rawTextSnapshot += '\n'+line;
        current.sourcePages=[...new Set([...current.sourcePages,page.page])];
        if(sourceLine.box)current.sourceRegions.push({page:page.page,box:sourceLine.box});
        current.readingIssues=readingRisks(current.textSnapshot);
      } else {
        if (leadingPage === null) leadingPage = page.page;
        leading.push(line);
      }
    }
  }
  flushLeading();
  if (current) requirements.push(current);
  for(const req of requirements)if(req.sourceRegions?.length){
    const pages=[...new Set(req.sourceRegions.map(r=>r.page))];
    req.sourceRegions=pages.map(page=>({page,box:regionUnion(req.sourceRegions.filter(r=>r.page===page).map(r=>({text:'source',box:r.box})))}));
  }
  return { requirements: uniqueRequirements(requirements), unreadablePages };
}

export function parseDocxBlocks(blocks) {
  const requirements = [];
  let paragraphs = [];
  function flushParagraphs() {
    if (!paragraphs.length) return;
    requirements.push(...parsePages([{ page: 1, text: paragraphs.join('\n') }]).requirements.map(item => ({ ...item, sourcePage: null })));
    paragraphs = [];
  }
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      if (block.text?.trim()) paragraphs.push(block.text.trim());
      continue;
    }
    if (block.type !== 'tableRow') continue;
    flushParagraphs();
    const number = String(block.cells?.[0] || '').trim().replace(/[.)]$/u, '');
    const text = String(block.cells?.[1] || '').trim();
    if (/^[0-9๐-๙]+(?:\.[0-9๐-๙]+)*$/u.test(number) && text) {
      requirements.push({ id: sectionNumber(number), title: text.slice(0, 120), textSnapshot: text, sourcePage: null, sourceMethod: 'text' });
    } else if (!/^(ข้อ|ลำดับ)/u.test(number) && text && requirements.length) {
      requirements[requirements.length - 1].textSnapshot += '\n' + text;
    }
  }
  flushParagraphs();
  return { requirements: uniqueRequirements(requirements), unreadablePages: [] };
}

export function reviewComparison({ proposal, comparison, productId, evidence, docs }) {
  if (comparison !== 'ตรงตามข้อกำหนด') return comparison;
  if (!proposal?.trim()) throw new Error('กรุณากรอกรายละเอียดที่เสนอก่อนระบุตรงตามข้อกำหนด');
  if (!evidence?.length) throw new Error('กรุณาผูกหลักฐานก่อนระบุตรงตามข้อกำหนด');
  if (productId && !evidence.some(item => {
    const doc = docs.find(entry => entry.id === item.docId);
    return doc && (!doc.productId || doc.productId === productId);
  })) throw new Error('หลักฐานไม่ตรงกับสินค้าที่เลือก');
  return comparison;
}

export function rankDocuments(requirement, docs) {
  const query = requirement.toLowerCase();
  const terms = new Set(domainTerms.filter(term => query.includes(term.toLowerCase())));
  for (const term of requirement.match(/[A-Za-z][A-Za-z0-9._+-]{2,}/gu) ?? []) terms.add(term);
  return docs.map(doc => {
    const haystack = `${doc.name ?? ''} ${doc.productName ?? ''} ${doc.searchText ?? ''}`.toLowerCase();
    const matchedTerms = [...terms].filter(term => haystack.includes(term.toLowerCase())).sort((a, b) => a.localeCompare(b, 'en'));
    return { ...doc, matchedTerms };
  }).filter(doc => doc.matchedTerms.length).sort((a, b) => b.matchedTerms.length - a.matchedTerms.length || a.name.localeCompare(b.name));
}

export function makeSearchIndex(text) {
  const lower = text.toLowerCase();
  const terms = new Set(domainTerms.filter(term => lower.includes(term.toLowerCase())));
  for (const term of text.match(/[A-Za-z][A-Za-z0-9._+-]{2,}/gu) ?? []) terms.add(term);
  return [...terms].join(' ').slice(0, 8000);
}

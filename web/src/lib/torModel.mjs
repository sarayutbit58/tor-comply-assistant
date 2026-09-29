const headingPattern = /^\s*(?:ข้อ\s*)?([0-9๐-๙]+(?:\.[0-9๐-๙]+)*)(?:[.)])?\s+(.{3,})$/u;
const domainTerms = ['MPLS', 'IPv6', 'IPv4', 'NOC', 'SLA', 'VPN', 'Firewall', 'Switch', 'Router', 'Server', 'Storage', 'วงจร', 'เครือข่าย', 'รายงาน', 'บริการ'];
const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';

function sectionNumber(value) {
  return value.replace(/[๐-๙]/gu, digit => String(thaiDigits.indexOf(digit)));
}

function heading(raw) {
  const line = raw.trim().replace(/\s+/gu, ' ');
  const match = headingPattern.exec(line);
  if (!match) return null;
  if (!match[1].includes('.') && !line.startsWith('ข้อ') && line.length < 26) return null;
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
    if (!page.text?.trim()) {
      unreadablePages.push(page.page);
      continue;
    }
    for (const raw of page.text.split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line) continue;
      const found = heading(line);
      if (found) {
        flushLeading();
        if (current) requirements.push(current);
        current = { id: found.id, title: found.text.slice(0, 120), textSnapshot: found.text, sourcePage: page.page, sourceMethod };
      } else if (current) {
        current.textSnapshot += '\n' + line;
      } else {
        if (leadingPage === null) leadingPage = page.page;
        leading.push(line);
      }
    }
  }
  flushLeading();
  if (current) requirements.push(current);
  return { requirements, unreadablePages };
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

export const RULE_VERSION = '2026.09.29-1';
export const PRIORITIES = ['Internet', 'Network', 'Server', 'CCTV', 'Security'];
const digits = '๐๑๒๓๔๕๖๗๘๙';
const aliases = [
  [/full[ -]?duplex|สองทิศทางพร้อมกัน/gi, 'full_duplex'],
  [/รับประกัน|\bwarrant(?:y|ies)\b/gi, 'warranty'],
  [/พอร์ต|\bports?\b/gi, 'port'], [/แกนประมวลผล|คอร์|\bcores?\b/gi, 'core'],
  [/ปี|\byears?\b/gi, 'year'], [/เดือน|\bmonths?\b/gi, 'month'],
  [/ชั่วโมง|\bhours?\b|\bhrs?\b/gi, 'hour'], [/วัน|\bdays?\b/gi, 'day'],
  [/วงจร|\bcircuits?\b/gi, 'circuit'], [/ช่องสัญญาณ|\bchannels?\b/gi, 'channel'],
  [/ความพร้อมใช้งาน|availability/gi, 'availability'],
  [/ระยะเวลาตอบสนอง|response time/gi, 'response_time'],
  [/ภายในประเทศ|domestic|\bnix\b/gi, 'nix'],
  [/ระหว่างประเทศ|international|\biig\b/gi, 'iig'],
];
const stop = new Set(('ต้อง มี และ หรือ สามารถ รองรับ ได้ ที่ ให้ เป็น การ ของ จำนวน แบบ ไม่น้อยกว่า ไม่เกิน มากกว่า น้อยกว่า อย่างน้อย อย่างมาก ความเร็ว ความจุ ระบบ อุปกรณ์ the a an and or at least no more than minimum maximum support supports supported shall must with of up to not less greater equal than speed capacity มีความเร็ว มีจำนวน').split(' '));
const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
export function normalizeText(value) {
  let text = String(value || '').normalize('NFKC').replace(/[๐-๙]/gu, d => String(digits.indexOf(d)));
  text = text.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').replace(/(\d)\s*[gG](?=\s|$|\/)/g, '$1 Gbps');
  for (const [pattern, term] of aliases) text = text.replace(pattern, ' ' + term + ' ');
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
const measurement = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*(tbps|gbps|mbps|kbps|bps|tb|gb|mb|ghz|mhz|fps|ms|mp|watt|w|%|port|core|year|month|hour|day|circuit|channel|เส้นทาง|ชุด|เครื่อง|ตัว|แห่ง|ip)(?![a-z])/g;
const rate = { tbps: 1e6, gbps: 1e3, mbps: 1, kbps: .001, bps: .000001 };
const qualifiers = ['iig', 'nix', 'upload', 'download', 'ram', 'cpu', 'storage', 'response_time', 'availability'];
function quantityRules(text) {
  return [...text.matchAll(measurement)].map(match => {
    const prefix = text.slice(Math.max(0, match.index - 70), match.index);
    const lastBoundary = Math.max(prefix.lastIndexOf('และ'), prefix.lastIndexOf(';'), prefix.lastIndexOf(' and '));
    const context = prefix.slice(lastBoundary + 1);
    const qualifier = qualifiers.filter(term => context.includes(term)).sort((a, b) => context.lastIndexOf(b) - context.lastIndexOf(a))[0] || '';
    const suffix = text.slice(match.index + match[0].length, match.index + match[0].length + 18);
    let op = '=';
    if (/ไม่น้อยกว่า|อย่างน้อย|at least|minimum|>=|≥/.test(context) || /or more/.test(suffix)) op = '>=';
    else if (/ไม่เกิน|อย่างมาก|at most|maximum|<=|≤/.test(context) || /or less/.test(suffix)) op = '<=';
    else if (/มากกว่า|greater than|>/.test(context)) op = '>';
    else if (/น้อยกว่า|less than|</.test(context)) op = '<';
    const factor = rate[match[2]] || 1;
    return { label: match[0], qualifier, op, values: match[1].split('/').map(v => Number(v.trim()) * factor), unit: rate[match[2]] ? 'mbps' : match[2], start: match.index, end: match.index + match[0].length };
  });
}
export function keywordTerms(value) {
  const text = normalizeText(value).replace(measurement, ' ').replace(/ไม่น้อยกว่า|ไม่เกิน|อย่างน้อย|อย่างมาก|มากกว่า|น้อยกว่า|at least|minimum|maximum|no more than|>=|<=|[≥≤]/g, ' ');
  const latin = text.match(/[a-z0-9]+(?:[_.:-][a-z0-9]+)*/g) || [];
  const thai = [...segmenter.segment(text.replace(/[a-z0-9_.-]+/g, ' '))].filter(s => s.isWordLike).map(s => s.segment);
  return [...new Set([...latin, ...thai].filter(t => !stop.has(t) && (t.length > 1 || /^\d+$/.test(t))))];
}
function containsTerm(text,term) {
  if (/^[a-z0-9]/.test(term)) return text.split(/[^a-z0-9_.:-]+/).includes(term);
  return text.includes(term);
}
function polarity(text, term) {
  const index = text.indexOf(term);
  if (index < 0) return null;
  const before = text.slice(Math.max(0, index - 32), index);
  const after = text.slice(index + term.length, index + term.length + 30);
  if (/ไม่รองรับ|ไม่มี|ไม่สามารถ|does not support|not support|without|no\s*$/.test(before) || /^\s*(?:is )?not supported/.test(after)) return 'negative';
  if (/optional|license required|ต้องซื้อเพิ่ม|ขึ้นอยู่กับ|อาจ|may support/.test(text)) return 'conditional';
  return 'positive';
}
export function evaluateRequirement(requirement, snippets) {
  const tor = normalizeText(requirement);
  const sources = snippets.filter(s => s.text?.trim()).map(s => ({ ...s, normalized: normalizeText(s.text) }));
  const checks = [];
  const terms = keywordTerms(requirement);
  for (const term of terms) {
    const matching = sources.filter(s => containsTerm(s.normalized,term));
    const positive = matching.filter(s => polarity(s.normalized, term) === 'positive');
    const negative = matching.filter(s => polarity(s.normalized, term) === 'negative');
    const expectedNegative = polarity(tor, term) === 'negative';
    const valid = expectedNegative ? negative : positive;
    const invalid = expectedNegative ? positive : negative;
    const outcome = valid.length && invalid.length ? 'pending' : valid.length ? 'pass' : invalid.length ? 'fail' : 'pending';
    checks.push({ label: term, outcome, reason: valid.length && invalid.length ? 'หลักฐานขัดแย้งกัน' : outcome === 'pass' ? 'พบข้อความรองรับ' : outcome === 'fail' ? 'พบข้อความตรงข้าม' : 'ยังไม่มีข้อความยืนยันที่ชัดเจน', sourceIds: matching.map(s => s.id) });
  }
  for (const expected of quantityRules(tor)) {
    const matches = sources.flatMap(source => quantityRules(source.normalized).filter(actual => actual.unit === expected.unit && (!expected.qualifier || actual.qualifier === expected.qualifier)).map(actual => ({ ...actual, source })));
    const compare = value => expected.values.every(want => expected.op === '>=' ? value >= want : expected.op === '<=' ? value <= want : expected.op === '>' ? value > want : expected.op === '<' ? value < want : value === want);
    const valid = matches.filter(actual => expected.values.every(want => actual.values.some(value => expected.op === '=' ? value === want : compare(value))));
    const invalid = matches.filter(actual => !valid.includes(actual));
    // An exact supported speed absent from a multi-rate list is missing proof, not a claimed incompatibility.
    const outcome = valid.length && invalid.length ? 'pending' : valid.length ? 'pass' : invalid.length && expected.op !== '=' ? 'fail' : 'pending';
    checks.push({ label: [expected.qualifier, expected.op, expected.label].filter(Boolean).join(' '), outcome, reason: valid.length && invalid.length ? 'ค่าจากหลักฐานขัดแย้งกัน' : outcome === 'pass' ? 'ค่าและหน่วยตรงตามกฎ' : outcome === 'fail' ? 'ค่าที่ระบุไม่ผ่านเกณฑ์' : 'ยังไม่พบค่าที่ TOR ต้องการ', sourceIds: matches.map(m => m.source.id) });
  }
  if (!checks.length) checks.push({ label: 'ข้อกำหนด', outcome: 'pending', reason: 'ยังแยกเงื่อนไขนี้เป็นกฎไม่ได้', sourceIds: [] });
  const status = checks.some(c => c.outcome === 'fail') ? 'fail' : checks.every(c => c.outcome === 'pass') ? 'pass' : 'pending';
  return { status, checks, ruleVersion: RULE_VERSION };
}

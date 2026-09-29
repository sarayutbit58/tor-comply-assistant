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
  [/หน่วยความจำ|\bmemory\b|\bram\b/gi, 'ram'],
  [/พื้นที่จัดเก็บ|ความจุจัดเก็บ|\bstorage\b|disk capacity/gi, 'storage'],
  [/ภายในประเทศ|domestic|\bnix\b/gi, 'nix'],
  [/ระหว่างประเทศ|international|\biig\b/gi, 'iig'],
];
const stop = new Set(('ต้อง มี และ หรือ สามารถ รองรับ ได้ ที่ ให้ เป็น การ ของ จำนวน แบบ ไม่น้อยกว่า ไม่เกิน มากกว่า น้อยกว่า อย่างน้อย อย่างมาก ความเร็ว ความจุ ระบบ อุปกรณ์ the a an and or at least no more than minimum maximum support supports supported shall must with of up to not less greater equal than speed capacity มีความเร็ว มีจำนวน').split(' '));
const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
export function normalizeText(value) {
  let text = String(value || '').normalize('NFKC').replace(/[๐-๙]/gu, d => String(digits.indexOf(d)));
  text=text.replace(/([kKmMgGtT]?)B(?:ps|\/s)\b/g,(_,prefix)=>prefix.toLowerCase()+'byteps');
  text=text.replace(/([kKmMgGtT])b\b/g,(_,prefix)=>prefix.toLowerCase()+'bit');
  text = text.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').replace(/(\d)\s*[gG](?=\s|$|\/)/g, '$1 Gbps');
  for (const [pattern, term] of aliases) text = text.replace(pattern, ' ' + term + ' ');
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
const measurement = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*(tbyteps|gbyteps|mbyteps|kbyteps|byteps|tbps|gbps|mbps|kbps|bps|tbit|gbit|mbit|kbit|tib|gib|mib|tb|gb|mb|kb|ghz|mhz|fps|ms|mp|watt|w|%|port|core|year|month|hour|day|circuit|channel|เส้นทาง|ชุด|เครื่อง|ตัว|แห่ง|ip)(?![a-z])/g;
const rate = { tbps: 1e6, gbps: 1e3, mbps: 1, kbps: .001, bps: .000001,tbyteps:8e6,gbyteps:8e3,mbyteps:8,kbyteps:.008,byteps:.000008 };
const capacity={tb:1e12,gb:1e9,mb:1e6,kb:1e3,tbit:1e12/8,gbit:1e9/8,mbit:1e6/8,kbit:1e3/8,tib:1024**4,gib:1024**3,mib:1024**2};
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
    const factor = rate[match[2]] || capacity[match[2]] || 1;
    return { label: match[0], qualifier, op, values: match[1].split('/').map(v => Number(v.trim()) * factor), unit: rate[match[2]] ? 'mbps' : capacity[match[2]]?'bytes':match[2], start: match.index, end: match.index + match[0].length };
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
  const found=[];
  for(let index=text.indexOf(term);index>=0;index=text.indexOf(term,index+term.length)){
    const before=text.slice(Math.max(0,index-40,text.lastIndexOf(';',index)+1),index);
    const after=text.slice(index+term.length,index+term.length+40).split(';')[0];
    if(/ไม่รองรับ|ไม่มี|ไม่สามารถ|does not support|not support|without|no\s*$/.test(before)||/^\s*[:=-]?\s*(?:(?:is|support)\s*:?\s*)?(?:not supported|unsupported|no\b)/.test(after))found.push('negative');
    else if(/optional|license required|ต้องซื้อเพิ่ม|ขึ้นอยู่กับ|อาจ|may support/.test(before+term+after))found.push('conditional');
    else found.push('positive');
  }
  if(found.includes('positive')&&found.includes('negative'))return 'conflict';
  return found.includes('conditional')?'conditional':found[0]||null;
}
function range(value,op) {
  return {low:op.startsWith('<')?-Infinity:value,high:op.startsWith('>')?Infinity:value,lowOpen:op==='>',highOpen:op==='<'};
}
function rangeOutcome(want,got) {
  const lower=got.low>want.low||(got.low===want.low&&(!want.lowOpen||got.lowOpen));
  const upper=got.high<want.high||(got.high===want.high&&(!want.highOpen||got.highOpen));
  if(lower&&upper)return 'pass';
  if(got.high<want.low||got.low>want.high||(got.high===want.low&&(got.highOpen||want.lowOpen))||(got.low===want.high&&(got.lowOpen||want.highOpen)))return 'fail';
  return 'pending';
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
    const conflict=matching.some(s=>polarity(s.normalized,term)==='conflict');
    const outcome = conflict||valid.length && invalid.length ? 'pending' : valid.length ? 'pass' : invalid.length ? 'fail' : 'pending';
    checks.push({ label: term, outcome, reason: valid.length && invalid.length ? 'หลักฐานขัดแย้งกัน' : outcome === 'pass' ? 'พบข้อความรองรับ' : outcome === 'fail' ? 'พบข้อความตรงข้าม' : 'ยังไม่มีข้อความยืนยันที่ชัดเจน', sourceIds: matching.map(s => s.id) });
  }
  for (const expected of quantityRules(tor)) {
    const matches = sources.flatMap(source => quantityRules(source.normalized).filter(actual => actual.unit === expected.unit && actual.qualifier === expected.qualifier).map(actual => ({ ...actual, source })));
    const expectedNegative=polarity(tor,expected.label)==='negative';
    const outcomes=matches.map(actual=>{
      const direction=polarity(actual.source.normalized,actual.label);
      if(direction==='conditional'||direction==='conflict')return 'pending';
      const results=expected.values.map(want=>{
        const values=actual.values.map(value=>rangeOutcome(range(want,expected.op),range(value,actual.op)));
        return values.includes('pass')?'pass':values.every(v=>v==='fail')?'fail':'pending';
      });
      let result=results.every(v=>v==='pass')?'pass':results.includes('fail')?'fail':'pending';
      if(result==='pass' && (direction==='negative')!==expectedNegative)return 'fail';
      if(result==='fail'&&expected.unit==='mbps'&&expected.op==='=')result='pending';
      return result;
    });
    const valid=outcomes.filter(o=>o==='pass'),invalid=outcomes.filter(o=>o==='fail');
    const outcome=valid.length&&invalid.length?'pending':valid.length?'pass':invalid.length?'fail':'pending';
    checks.push({ label: [expected.qualifier, expected.op, expected.label].filter(Boolean).join(' '), outcome, reason: valid.length && invalid.length ? 'ค่าจากหลักฐานขัดแย้งกัน' : outcome === 'pass' ? 'ค่าและหน่วยตรงตามกฎ' : outcome === 'fail' ? 'ค่าที่ระบุไม่ผ่านเกณฑ์' : 'ยังไม่พบค่าที่ TOR ต้องการ', sourceIds: matches.map(m => m.source.id) });
  }
  if (!checks.length) checks.push({ label: 'ข้อกำหนด', outcome: 'pending', reason: 'ยังแยกเงื่อนไขนี้เป็นกฎไม่ได้', sourceIds: [] });
  const status = checks.some(c => c.outcome === 'fail') ? 'fail' : checks.every(c => c.outcome === 'pass') ? 'pass' : 'pending';
  return { status, checks, ruleVersion: RULE_VERSION };
}

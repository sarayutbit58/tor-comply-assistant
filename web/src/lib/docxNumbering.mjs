export const MAX_NUMBERING_RECORDS = 4096;
const explicitClause = value => {
  const match = /^\s*(ข้อ\s*)?([0-9๐-๙]+(?:\.[0-9๐-๙]+)*)([.)])?(?:\s|$)/u.exec(value);
  return Boolean(match && (match[1] || match[2].includes('.') || match[3]));
};
const validCounter = value => Number.isSafeInteger(value) && value >= 0 && value < 1000000000;

export function applyDocxNumbering(paragraphs, model = {}) {
  const abstracts = model.abstracts || [], instances = model.instances || [];
  if (!Array.isArray(paragraphs) || !Array.isArray(abstracts) || !Array.isArray(instances) || paragraphs.length > 30000 || abstracts.length > MAX_NUMBERING_RECORDS || instances.length > MAX_NUMBERING_RECORDS) throw new Error('จำนวนลำดับ DOCX เกินขนาดที่รองรับ');
  if (abstracts.some(item => !Array.isArray(item.levels) || item.levels.length>9) || instances.some(item => (item.overrides || []).length>9)) throw new Error('จำนวนระดับลำดับ DOCX เกินขนาดที่รองรับ');
  const abstractMap = new Map(abstracts.map(item => [String(item.id),item]));
  const instanceMap = new Map(instances.map(item => [String(item.id),item]));
  const duplicates = values => new Set(values.filter((id,index) => values.indexOf(id)!==index));
  const repeatedAbstracts=duplicates(abstracts.map(item=>String(item.id))), repeatedInstances=duplicates(instances.map(item=>String(item.id)));
  const numberedStyles=new Set(abstracts.flatMap(item=>item.levels.map(level=>level.styleId).filter(Boolean)));
  const counters = new Map(), warnings = new Set();
  const output = paragraphs.map(paragraph => {
    const source = String(paragraph.text || '');
    if (String(paragraph.numId)==='0') return {...paragraph,text:source};
    if (paragraph.numId===null || paragraph.numId===undefined) {
      if (!numberedStyles.has(paragraph.styleId)) return {...paragraph,text:source};
      const message='ลำดับจากสไตล์ '+paragraph.styleId+' ยังไม่มีข้อมูลเลขข้อของย่อหน้านี้ โปรดตรวจต้นฉบับและระบุเลขข้อเอง';
      warnings.add(message);return {...paragraph,text:source,numberingWarning:message};
    }
    const numId = String(paragraph.numId), depth = Number(paragraph.level ?? 0);
    const warn = reason => {
      const message = `ลำดับอัตโนมัติ ${numId} ระดับ ${depth}: ${reason} โปรดตรวจต้นฉบับและระบุเลขข้อเอง`;
      warnings.add(message);return {...paragraph,text:source,numberingWarning:message};
    };
    const instance = instanceMap.get(numId), abstract = instance && abstractMap.get(String(instance.abstractId));
    if (!instance || !abstract) return warn('ไม่พบข้อมูลเลขข้อ');
    if (repeatedInstances.has(numId) || repeatedAbstracts.has(String(instance.abstractId))) return warn('ข้อมูลเลขลำดับซ้ำและไม่ชัดเจน');
    if (abstract.styleLinked) return warn('ยังไม่รองรับลำดับที่อ้างสไตล์อื่น');
    if (!Number.isInteger(depth) || depth<0 || depth>8) return warn('ระดับเลขข้อไม่ถูกต้อง');
    const getLevel = index => {
      const base = abstract.levels.find(level => Number(level.level)===index);
      const override = (instance.overrides || []).find(level => Number(level.level)===index);
      const definition = override?.definition || base;
      return definition ? {...definition,start:override?.start ?? definition.start ?? 1} : null;
    };
    const definition = getLevel(depth);
    if (!definition || definition.format!=='decimal' || typeof definition.pattern!=='string' || !/^%[1-9](?:\.%[1-9])*(?:[.)])?$/u.test(definition.pattern) || !validCounter(definition.start)) return warn('รูปแบบเลขข้อยังไม่รองรับ');
    if (definition.restart!==undefined && (!Number.isInteger(definition.restart) || definition.restart<0 || definition.restart>depth)) return warn('กฎเริ่มลำดับใหม่ยังไม่รองรับ');
    const references = [...definition.pattern.matchAll(/%([1-9])/g)].map(match => Number(match[1])-1);
    if (references.some(index => index>depth || getLevel(index)?.format!=='decimal' || !validCounter(getLevel(index)?.start))) return warn('รูปแบบเลขข้อข้ามระดับยังไม่รองรับ');
    const values = counters.get(numId) || Array(9).fill(null);
    values[depth] = values[depth]===null ? definition.start : values[depth]+1;
    if (!validCounter(values[depth])) return warn('ตัวเลขลำดับเกินขนาดที่รองรับ');
    const resetLevels = new Set([depth]);
    for (let child=depth+1;child<9;child++) {
      const childLevel = getLevel(child);
      if (!childLevel || childLevel.restart===0) continue;
      const restartAt = childLevel.restart===undefined ? child-1 : Number(childLevel.restart)-1;
      if (resetLevels.has(restartAt)) {values[child]=null;resetLevels.add(child);}
    }
    const label = definition.pattern.replace(/%([1-9])/g,(_,index) => {
      const level = Number(index)-1;
      if (values[level]===null) values[level]=getLevel(level).start;
      return String(values[level]);
    });
    counters.set(numId,values);
    if (explicitClause(source)) return {...paragraph,text:source,label};
    const prefix = /^\d+$/u.test(label) ? 'ข้อ '+label : label;
    return {...paragraph,text:source.trim() ? prefix+' '+source : label,label};
  });
  return {paragraphs:output,warnings:[...warnings]};
}

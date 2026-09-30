const digits='๐๑๒๓๔๕๖๗๘๙';
const normalized=text=>String(text||'').normalize('NFC').replace(/[๐-๙]/gu,d=>String(digits.indexOf(d))).replace(/[\u200B\u200C\u200D\uFEFF]/gu,'').replace(/\s+/gu,' ').trim();
const valid=item=>typeof item?.text==='string'&&Array.isArray(item.box)&&item.box.length===4&&item.box.every(Number.isFinite)&&item.box[2]>0&&item.box[3]>0;
export function regionUnion(items) {
 const good=items.filter(valid);if(!good.length)return null;
 const x=Math.max(0,Math.min(...good.map(i=>i.box[0]))),y=Math.max(0,Math.min(...good.map(i=>i.box[1])));
 return [x,y,Math.max(.001,Math.min(1,Math.max(...good.map(i=>i.box[0]+i.box[2])))-x),Math.max(.001,Math.min(1,Math.max(...good.map(i=>i.box[1]+i.box[3])))-y)];
}
export function reconstructReading(items=[]) {
 const rawText=items.map(i=>i.text||'').join(' ').trim();
 const ordered=items.filter(i=>valid(i)&&i.text.trim()).map((i,index)=>({...i,index,baseline:i.box[1]+i.box[3]})).sort((a,b)=>a.baseline-b.baseline||a.box[0]-b.box[0]||a.index-b.index);
 const groups=[];
 for(const item of ordered) {
  const last=groups.at(-1),tolerance=Math.max(.003,Math.min(.01,item.box[3]*.45));
  if(last&&Math.abs(item.baseline-last.baseline)<=tolerance)last.items.push(item);
  else groups.push({baseline:item.baseline,items:[item]});
 }
 let wideGaps=false;
 const lines=groups.map(group=>{
  const line=group.items.sort((a,b)=>a.box[0]-b.box[0]||a.index-b.index);let text='';
  line.forEach((item,index)=>{
   const previous=line[index-1];let separator='';
   if(previous){
    const gap=item.box[0]-previous.box[0]-previous.box[2];
    if(gap>.15)wideGaps=true;
    const touching=gap<=Math.min(previous.box[3],item.box[3])*.2;
    if(!/\s$/u.test(text)&&!/^\s|^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/u.test(item.text)&&!touching)separator=' ';
   }
   text+=separator+item.text;
  });
  return {text:text.normalize('NFC').trim(),box:regionUnion(line),items:line};
 });
 const text=lines.map(l=>l.text).join('\n');
 const issues=readingRisks(text);
 if(wideGaps)issues.push({code:'column-gaps',severity:'review',label:'ข้อความหลายคอลัมน์',reason:'ตรวจคอลัมน์และข้อความหัว/ท้ายหน้าเทียบต้นฉบับ'});
 if(items.some(i=>!valid(i)))issues.push({code:'invalid-geometry',severity:'review',label:'ตำแหน่งข้อความไม่ครบ',reason:'บางข้อความไม่มีพิกัดที่ใช้อ่านลำดับได้'});
 return {text,rawText,lines,issues};
}
export function readingInBox(page,box) {
 if(!Array.isArray(box)||box.length!==4)return '';
 const selected=(page?.items||[]).filter(i=>valid(i)&&i.box[0]+i.box[2]>box[0]&&i.box[0]<box[0]+box[2]&&i.box[1]+i.box[3]>box[1]&&i.box[1]<box[1]+box[3]);
 return reconstructReading(selected).text;
}
export function criticalTokens(text) {
 const value=normalized(text),tokens=[];
 for(const match of value.matchAll(/\d+(?:\.\d+)*(?:\s*(?:[kKmMgGtT]?[bB]ps|[kKmMgGtT]?[bB](?:ytes?)?|Mbps|Gbps|พอร์ต|ports?|ปี|years?|เดือน|months?|ช่อง|cores?|GB|TB))?/gu))tokens.push(match[0].replace(/\s+/gu,''));
 for(const match of value.matchAll(/ไม่น้อยกว่า|ไม่เกิน|อย่างน้อย|ขั้นต่ำ|สูงสุด|ไม่รองรับ|ห้าม|ไม[่่]|at least|at most|minimum|maximum|not supported|unsupported|not|no\b|without/giu))tokens.push(match[0].toLowerCase());
 return tokens.sort();
}
export function compareReadings(before,after) {
 const beforeTokens=criticalTokens(before),afterTokens=criticalTokens(after);
 const difference=(a,b)=>{const rest=[...b];return a.filter(v=>{const i=rest.indexOf(v);if(i<0)return true;rest.splice(i,1);return false;});};
 return {changed:normalized(before)!==normalized(after),criticalChanged:JSON.stringify(beforeTokens)!==JSON.stringify(afterTokens),beforeTokens,afterTokens,removed:difference(beforeTokens,afterTokens),added:difference(afterTokens,beforeTokens)};
}
export function readingRisks(text) {
 const value=String(text||''),issues=[];
 if(criticalTokens(value).length)issues.push({code:'critical-values',severity:'review',label:'ตัวเลข หน่วย หรือคำกำหนด',reason:'เทียบจำนวน หน่วย เงื่อนไขขั้นต่ำ/สูงสุดและคำปฏิเสธกับภาพต้นฉบับ'});
 if(/[\uFFFD\uFFFC\u0000]|\(cid:\d+\)/u.test(value)||/(?:^|\s)[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/u.test(value))issues.push({code:'broken-glyphs',severity:'high',label:'อักขระอาจเพี้ยน',reason:'พบอักขระแทนหรือสระ/วรรณยุกต์แยก ตรวจเทียบภาพหรืออ่านข้อความใหม่'});
 if(/\S\s+(?:ข้อ\s*)?\d+(?:\.\d+)+\s+[A-Za-zก-๙]/u.test(value))issues.push({code:'inline-clause',severity:'review',label:'อาจมีเลขข้ออยู่กลางบรรทัด',reason:'ตรวจว่าเป็นข้อใหม่หรือเป็นเลข/การอ้างอิงในข้อความเดิม'});
 return issues;
}

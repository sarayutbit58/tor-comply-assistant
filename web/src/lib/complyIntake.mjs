import {uniqueRequirements} from './torModel.mjs';
import {guessField} from './tableModel.mjs';
const digits='๐๑๒๓๔๕๖๗๘๙';
const normalizeId=value=>String(value).replace(/[๐-๙]/gu,d=>String(digits.indexOf(d)));
const clean=value=>String(value??'').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
const signature=value=>clean(value).replace(/\s+/g,'').toLowerCase();
const numberOnly=/^(?:ข้อ\s*)?([0-9๐-๙]+(?:\.[0-9๐-๙]+)*(?:\([a-zA-Zก-ฮ]\))?)[.)]?$/u;
const numberedText=/^(?:ข้อ\s*)?([0-9๐-๙]+(?:\.[0-9๐-๙]+)*(?:\([a-zA-Zก-ฮ]\))?)[.)]?\s+([\s\S]+)$/u;
export function inferSourceMapping(headers) {
  const fields=headers.map(guessField);
  const numberColumn=fields.indexOf('number');
  const textColumn=fields.indexOf('requirement');
  return {numberColumn:numberColumn<0?null:numberColumn,textColumn:textColumn<0?Math.min(1,headers.length-1):textColumn};
}
export function compatibleTable(a,b) {
  return a.headers.length===b.headers.length&&a.headers.every((header,i)=>signature(header)===signature(b.headers[i]));
}
export function isComplyTable(table) {
  const headers=table.headers.join(' ');
  if(/\btor\b|requirement|ข้อกำหนด|รายละเอียดตาม|เปรียบเทียบ|อ้างอิง|compliance/i.test(headers))return true;
  return table.rows.some(row=>row.cells.some(cell=>/^(?:ข้อ\s*)?[0-9๐-๙]{1,4}(?:\.[0-9๐-๙]+)*(?:[.)]?\s+\S.*)?$/u.test(clean(cell))));
}
export function extractComplyRequirements(tables,{numberColumn=null,textColumn}) {
  if(!Number.isInteger(textColumn)||textColumn<0)throw new Error('เลือกคอลัมน์ข้อกำหนด TOR');
  if(numberColumn!==null&&(!Number.isInteger(numberColumn)||numberColumn<0||numberColumn===textColumn))throw new Error('คอลัมน์เลขข้อและ TOR ต้องแยกกัน หรือเลือกเลขข้ออยู่ในข้อความ TOR');
  const requirements=[],warnings=[];
  let current=null,skipped=0;
  for(const table of tables) {
    if(textColumn>=table.headers.length||(numberColumn!==null&&numberColumn>=table.headers.length))throw new Error('คอลัมน์ที่เลือกไม่ตรงกับตาราง');
    const selectedHeader=table.headers[textColumn];
    if(/ผู้เสนอ|รายละเอียดที่เสนอ|propos|offered|reference|อ้างอิง|เปรียบเทียบ|comparison|compliance|result|status|^ผล$/i.test(selectedHeader))throw new Error('คอลัมน์ที่เลือกเป็นคำตอบหรือผลเดิม กรุณาเลือกข้อกำหนด TOR');
    for(const row of table.rows) {
      if(row.ambiguousColumns?.includes(textColumn)||(numberColumn!==null&&row.ambiguousColumns?.includes(numberColumn)))throw new Error('ข้อความ PDF คร่อมคอลัมน์ที่เลือก หน้า '+row.page+' กรุณาปรับขอบคอลัมน์ หรือใช้ DOCX/XLSX');
      const text=clean(row.cells[textColumn]);
      if(!text)continue;
      if(signature(text)===signature(selectedHeader))continue;
      const rawNumber=numberColumn===null?'':clean(row.cells[numberColumn]);
      const explicit=numberOnly.exec(rawNumber);
      if(rawNumber&&!explicit){skipped++;continue;}
      const embedded=numberedText.exec(text);
      const id=explicit?normalizeId(explicit[1]):numberColumn===null&&embedded?normalizeId(embedded[1]):null;
      if(id) {
        const body=embedded&&normalizeId(embedded[1])===id?clean(embedded[2]):text;
        current={id,title:body.slice(0,120),textSnapshot:body,sourcePage:table.format==='pdf'?row.page:null,sourceMethod:'table-text',sourceTableId:table.id,sourceTableIndex:table.tableIndex??null,sourceRow:row.row,reviewed:false};
        requirements.push(current);
      } else if(current)current.textSnapshot+='\n'+text;
      else skipped++;
    }
  }
  if(skipped)warnings.push('มี '+skipped+' แถวที่ไม่มีเลขข้อชัดเจนหรือเป็นข้อความนำ โปรดตรวจรายการที่อ่านได้');
  if(!requirements.length)warnings.push('ไม่พบเลขข้อและข้อกำหนด ช่องคำตอบว่างได้ แต่ตารางต้องมีข้อ TOR หรือเพิ่มข้อเองภายหลัง');
  return {requirements:uniqueRequirements(requirements),warnings};
}
export function validatePdfLayout(layout,count) {
  const edges=layout.edges;
  if(!Array.isArray(edges)||edges.length!==count+1||edges.some((x,i)=>!Number.isFinite(x)||x<0||x>1||(i&&x<=edges[i-1])))throw new Error('ขอบคอลัมน์ PDF ต้องเรียงจากซ้ายไปขวา และตรงกับจำนวนคอลัมน์');
  if(!(layout.headerBottom>=0&&layout.headerBottom<layout.bottom&&layout.bottom<=1))throw new Error('ขอบบน–ล่างของตาราง PDF ไม่ถูกต้อง');
}
export function pdfTableRows(pages,layout) {
  validatePdfLayout(layout,layout.edges.length-1);
  const count=layout.edges.length-1,rows=[];
  for(const page of pages) {
    const pageLayout=layout.pageLayouts?.[page.page]||layout;
    validatePdfLayout(pageLayout,count);
    const items=(page.items||[]).filter(i=>i.box[1]>=pageLayout.headerBottom-.002&&i.box[1]<pageLayout.bottom).sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0]);
    const rowEdges=layout.rowEdges?.[page.page];
    const groups=[];
    for(const item of items) {
      let group;
      if(rowEdges?.length>1) {
        const bucket=rowEdges.findIndex((y,i)=>i<rowEdges.length-1&&item.box[1]>=y-.002&&item.box[1]<rowEdges[i+1]-.002);
        if(bucket<0)continue;
        group=groups.find(g=>g.bucket===bucket);
        if(!group){group={bucket,y:item.box[1],items:[]};groups.push(group);}
      } else {
        group=groups.find(g=>Math.abs(g.y-item.box[1])<.008);
        if(!group){group={y:item.box[1],items:[]};groups.push(group);}
      }
      group.items.push(item);
    }
    for(const [rowIndex,group]of groups.entries()) {
      const cells=Array.from({length:count},()=>[]),ambiguous=new Set();
      for(const item of group.items) {
        const [x,,width]=item.box,center=x+width/2;
        const col=pageLayout.edges.findIndex((left,i)=>i<count&&center>=left&&center<pageLayout.edges[i+1]);
        if(col<0)continue;
        const overlaps=pageLayout.edges.slice(0,-1).map((left,i)=>Math.max(0,Math.min(x+width,pageLayout.edges[i+1])-Math.max(x,left)));
        const crossed=overlaps.map((w,i)=>w>.008?i:-1).filter(i=>i>=0);
        if(crossed.length>1)crossed.forEach(i=>ambiguous.add(i));
        cells[col].push(item);
      }
      const strings=cells.map(cell=>{
        const lines=[];
        for(const item of cell.sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0])) {
          let line=lines.find(l=>Math.abs(l.y-item.box[1])<.008);
          if(!line){line={y:item.box[1],text:[]};lines.push(line);}
          line.text.push(item.text);
        }
        return lines.map(l=>l.text.join(' ')).join('\n');
      });
      if(strings.some(Boolean))rows.push({cells:strings,page:page.page,row:rowIndex+1,ambiguousColumns:[...ambiguous]});
    }
  }
  return rows;
}

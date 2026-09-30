import {detectTableGrid} from './pdfTableGrid.mjs';
import {readOffice,nodes,attr,textOf} from './officeXml';
import {guessField} from './tableModel.mjs';
import {pdfTableRows,inferSourceMapping} from './complyIntake.mjs';
const headerScore=cells=>new Set(cells.filter(Boolean).map((text,i)=>{
  if(!/ลำดับ|เลขข้อ|รายละเอียด|ข้อกำหนด|ผู้เสนอ|อ้างอิง|เปรียบเทียบ|^ข้อ$|^TOR$|^เสนอ$|^ผล$|\bno\b|clause|requirement|propos|reference|result|comparison|compliance/i.test(text))return null;
  return guessField(text,i);
}).filter(Boolean)).size;
function headerIndex(rows) {
  let best=0,score=0;
  rows.slice(0,30).forEach((row,i)=>{const value=headerScore(row.cells);if(value>score){score=value;best=i;}});
  return {index:best,score};
}
function docxTables(office) {
  const doc=office.xml('word/document.xml');
  if(!doc)throw new Error('ไม่พบเนื้อหา DOCX');
  return nodes(doc,'tbl').flatMap((table,tableIndex)=>{
    for(let parent=table.parentElement;parent;parent=parent.parentElement)if(parent.localName==='tbl')return [];
    const rows=[...table.children].filter(n=>n.localName==='tr').map((tr,row)=>{
      const cells=[];
      for(const tc of [...tr.children].filter(n=>n.localName==='tc')) {
        const value=nodes(tc,'p').map(textOf).join('\n');
        const span=Math.min(12,Number(attr(nodes(tc,'gridSpan')[0],'val')||1));
        for(let i=0;i<span;i++)cells.push(value);
      }
      return {cells,row:row+1,page:null};
    });
    if(rows.length>10000)throw new Error('ตารางมีเกิน 10,000 แถว');
    const {index,score}=headerIndex(rows),headers=rows[index]?.cells;
    if(!headers||headers.length<2||headers.length>12)return [];
    return [{id:'docx:'+tableIndex,format:'docx',tableIndex,headerRow:index,score,headers,rows:rows.slice(index+1)}];
  });
}
function columnIndex(ref) {
  const letters=/^[A-Z]+/i.exec(ref||'')?.[0];
  if(!letters)return -1;
  return [...letters.toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
}
function xlsxTable(office) {
  const workbook=office.xml('xl/workbook.xml'),sheetInfo=workbook?nodes(workbook,'sheet')[0]:null;
  const rels=office.xml('xl/_rels/workbook.xml.rels');
  const relId=sheetInfo?.getAttribute('r:id');
  const target=rels?nodes(rels,'Relationship').find(n=>n.getAttribute('Id')===relId)?.getAttribute('Target'):null;
  const sheetPath=target?(target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'')):'xl/worksheets/sheet1.xml';
  const sheet=office.xml(sheetPath);
  if(!sheet)throw new Error('ไม่พบแผ่นงานแรกใน XLSX');
  const shared=office.xml('xl/sharedStrings.xml'),strings=shared?nodes(shared,'si').map(textOf):[];
  const raw=nodes(sheet,'row');
  if(raw.length>10000)throw new Error('แผ่นงานมีเกิน 10,000 แถว');
  const rows=raw.map((row,i)=>{
    const cells=[];
    for(const cell of nodes(row,'c')){
      const index=columnIndex(cell.getAttribute('r'));if(index<0||index>100)continue;
      cells[index]=cell.getAttribute('t')==='s'?strings[Number(nodes(cell,'v')[0]?.textContent)]||'':cell.getAttribute('t')==='inlineStr'?textOf(cell):nodes(cell,'v')[0]?.textContent||'';
    }
    return {cells:Array.from({length:cells.length},(_,i)=>cells[i]||''),row:Number(row.getAttribute('r')||i+1),page:null};
  });
  const {index,score}=headerIndex(rows);
  const rawHeader=rows[index]?.cells||[],offset=rawHeader.findIndex(Boolean);
  if(offset<0)throw new Error('ไม่พบหัวตารางในแผ่นงานแรก');
  const headers=rawHeader.slice(offset);
  if(headers.length<2||headers.length>12)throw new Error('หัวตารางต้องมี 2–12 คอลัมน์');
  return {id:'xlsx:0',format:'xlsx',headers,score,headerRow:index,sheetPath,sheetName:sheetInfo?.getAttribute('name')||'Sheet 1',columnOffset:offset,rows:rows.slice(index+1).map(r=>({...r,cells:r.cells.slice(offset,offset+headers.length)}))};
}
function pdfHeaderItems(page) {
  const anchors=page.items.filter(item=>/รายละเอียด|ข้อกำหนด|เอกสารอ้างอิง|เปรียบเทียบ|ลำดับ|เลขข้อ|requirement|propos|reference|result|comparison|status|clause|\bno\b/i.test(item.text)&&item.box[1]<.4);
  if(anchors.length<2)return [];
  const y=Math.min(...anchors.map(a=>a.box[1]));
  return anchors.filter(a=>Math.abs(a.box[1]-y)<.065).sort((a,b)=>a.box[0]-b.box[0]);
}
export async function readComplyDocument(file) {
  if(file.size>40*1024*1024)throw new Error('ไฟล์ตารางเกิน 40 MB');
  const format=file.name.split('.').pop().toLowerCase();
  const {readTemplate}=await import('./templateBrowser');
  if(format==='docx'||format==='xlsx') {
    const office=await readOffice(file),tables=format==='docx'?docxTables(office):[xlsxTable(office)];
    if(!tables.length)throw new Error('ไม่พบตารางที่อ่านได้ในไฟล์');
    const selected=[...tables].sort((a,b)=>b.score-a.score)[0];
    const template=await readTemplate(file,{office,tableIndex:selected.tableIndex,headerRow:selected.headerRow,sheetPath:selected.sheetPath,xlsxTable:selected,intake:true});
    return {format,tables,defaultTableId:selected.id,template,pages:[]};
  }
  if(format!=='pdf')throw new Error('ตาราง Comply รองรับ DOCX, PDF หรือ XLSX');
  const {loadPdf,extractPdf,paintPage}=await import('./pdfBrowser');
  const pages=await extractPdf(file);
  const unreadable=pages.filter(p=>!p.text.trim()).map(p=>p.page);
  if(unreadable.length)throw new Error('PDF หน้า '+unreadable.join(', ')+' ไม่มีข้อความให้อ่าน รอบนี้ใช้ PDF ที่เลือกข้อความได้ หรือ DOCX/XLSX');
  const template=await readTemplate(file,{pdfPages:pages,sourceRead:true});
  const headers=template.profile.columns.map(c=>c.heading),count=headers.length;
  const pdf=await loadPdf(file),pageLayouts={},rowEdges={};
  let firstLayout;
  try {
    for(const page of pages) {
      const anchors=pdfHeaderItems(page);
      const headerTextBottom=anchors.length?Math.max(...anchors.map(a=>a.box[1]+a.box[3])):null;
      const canvas=document.createElement('canvas');await paintPage(pdf,page.page,canvas,1.2);
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
      const band=anchors.length?[Math.max(0,Math.min(...anchors.map(a=>a.box[1]))-.02),headerTextBottom+.02]:null;
      const grid=detectTableGrid(pixels,count,band);canvas.width=1;canvas.height=1;
      let edges=grid?.edges;
      if(!edges){
        const groups=[];
        for(const anchor of anchors){if(!groups.some(x=>Math.abs(x-anchor.box[0])<.09))groups.push(anchor.box[0]);}
        const widths=template.profile.columns.map(c=>c.width),sum=widths.reduce((a,b)=>a+b,0);
        const left=groups[0]??.05;edges=[left];for(const w of widths)edges.push(Math.min(.98,edges[edges.length-1]+(.93-left)*w/sum));
        if(groups.length===count)edges=[Math.max(0,groups[0]-.015),...groups.slice(1).map(x=>Math.max(0,x-.01)),.96];
      }
      const headerBottom=headerTextBottom!==null?(grid?.rows.find(y=>y>headerTextBottom+.001&&y<headerTextBottom+.04)??headerTextBottom+.009):(grid?.rows[0]??.06);
      const bottom=grid?.rows[grid.rows.length-1]??.94;
      const cut={edges,headerBottom,bottom};
      pageLayouts[page.page]=cut;
      if(grid?.rows.length>1)rowEdges[page.page]=grid.rows.filter(y=>y>=headerBottom-.004);
      if(!firstLayout)firstLayout=cut;
    }
  } finally {await pdf.destroy();}
  const layout={...firstLayout,pageLayouts,rowEdges};
  const rows=pdfTableRows(pages,layout);
  return {format,tables:[{id:'pdf:0',format:'pdf',headers,headerRow:0,score:headerScore(headers),rows}],defaultTableId:'pdf:0',template,pages,pdfLayout:layout};
}
export async function templateForSource(file,prepared,table) {
  if(prepared.format!=='docx')return prepared.template;
  const {readTemplate}=await import('./templateBrowser');
  return readTemplate(file,{tableIndex:table.tableIndex,headerRow:table.headerRow,intake:true});
}
export {inferSourceMapping};

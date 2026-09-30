import {profileFor,tableRows} from './tableModel.mjs';
import {getFile} from './localFiles';
import {readOffice,nodes,WORD_NS} from './officeXml';
async function nativeWord(project) {
  const entry=await getFile(project.template.id);
  if(!entry)throw new Error('ไม่พบแม่แบบต้นฉบับ');
  const {archive,xml}=await readOffice(entry.blob),doc=xml('word/document.xml');
  const tables=nodes(doc,'tbl'),native=project.template.native;
  const targets=native.sourceTables||[{tableIndex:native.tableIndex,headerRow:native.headerRow}];
  for(const index of native.excludedTables||[])tables[index]?.remove();
  const profile=profileFor(project),make=name=>doc.createElementNS(WORD_NS,'w:'+name);
  function writeCell(cell,text) {
    const props=[...cell.children].find(n=>n.localName==='tcPr')?.cloneNode(true);
    const paragraphProps=nodes(cell,'pPr')[0]?.cloneNode(true);
    const runProps=nodes(cell,'rPr')[0]?.cloneNode(true);
    cell.replaceChildren();
    if(props){for(const merge of nodes(props,'vMerge'))merge.remove();cell.append(props);}
    for(const line of String(text||' ').split('\n')){
      const p=make('p');if(paragraphProps)p.append(paragraphProps.cloneNode(true));
      const r=make('r');if(runProps)r.append(runProps.cloneNode(true));
      const t=make('t');t.setAttribute('xml:space','preserve');t.textContent=line||' ';r.append(t);p.append(r);cell.append(p);
    }
  }
  for(const [targetIndex,target]of targets.entries()){
    const table=tables[target.tableIndex];if(!table)throw new Error('ไม่พบตารางแม่แบบที่เลือก');
    const rows=[...table.children].filter(n=>n.localName==='tr'),header=rows[target.headerRow];
    if(!header)throw new Error('ไม่พบหัวตารางแม่แบบ');
    const headerCells=[...header.children].filter(n=>n.localName==='tc');
    const base=rows.slice(target.headerRow+1).find(row=>[...row.children].filter(n=>n.localName==='tc').length===headerCells.length)||header;
    if(headerCells.length!==profile.columns.length)throw new Error('จำนวนคอลัมน์ไม่ตรงแม่แบบ DOCX');
    const subset=native.sourceTables?project.requirements.filter(req=>req.sourceTableIndex===target.tableIndex||(targetIndex===0&&(req.sourceTableIndex===null||req.sourceTableIndex===undefined))):project.requirements;
    const values=tableRows({...project,requirements:subset});
    headerCells.forEach((cell,i)=>writeCell(cell,profile.columns[i].heading));
    let trPr=[...header.children].find(n=>n.localName==='trPr');
    if(!trPr){trPr=make('trPr');header.prepend(trPr);}if(!nodes(trPr,'tblHeader').length)trPr.append(make('tblHeader'));
    const dataTemplate=base.cloneNode(true);
    for(const row of rows.slice(target.headerRow+1))row.remove();
    for(const row of values){
      const tr=dataTemplate.cloneNode(true),cells=[...tr.children].filter(n=>n.localName==='tc');
      if(cells.length!==profile.columns.length)tr.replaceChildren(...headerCells.map(c=>c.cloneNode(true)));
      [...tr.children].filter(n=>n.localName==='tc').forEach((cell,i)=>writeCell(cell,row[i]));
      for(const marker of nodes(tr,'tblHeader'))marker.remove();
      for(const height of nodes(tr,'trHeight'))height.remove();
      table.append(tr);
    }
  }
  const {zipSync,strToU8}=await import('fflate');
  archive['word/document.xml']=strToU8(new XMLSerializer().serializeToString(doc));
  return new Blob([zipSync(archive)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

export async function exportComplyWord(project) {
  if(project.template?.format==='docx'&&!project.template.native?.rebuildTable)return nativeWord(project);
  const {BorderStyle,Document,Packer,Paragraph,Table,TableCell,TableRow,TextRun,WidthType,ImageRun,Footer,PageNumber}=await import('docx');
  const p=profileFor(project),total=p.columns.reduce((n,c)=>n+c.width,0),usable=(p.pageWidth-2*(p.margin||30))*20;
  const widths=p.columns.map(c=>Math.round(usable*c.width/total));
  const border={style:BorderStyle.SINGLE,size:4,color:p.borderColor};
  function cell(text,width,header=false){
    return new TableCell({width:{size:width,type:WidthType.DXA},borders:{top:border,bottom:border,left:border,right:border},shading:header?{fill:p.headerFill}:undefined,children:String(text||' ').split('\n').map(line=>new Paragraph({children:[new TextRun({text:line||' ',bold:header,font:p.font,size:p.fontSize*2,color:header?p.headerColor:'262629'})]}))});
  }
  const header=new TableRow({tableHeader:true,children:p.columns.map((c,i)=>cell(c.heading,widths[i],true))});
  const rows=tableRows(project).map(row=>new TableRow({children:row.map((text,i)=>cell(text,widths[i]))}));
  const children=[];
  if(p.banner){
    const bytes=Uint8Array.from(atob(p.banner.split(',')[1]),c=>c.charCodeAt(0));
    children.push(new Paragraph({children:[new ImageRun({type:'png',data:bytes,transformation:{width:600,height:600*p.bannerRatio}})]}));
  }
  children.push(new Paragraph({children:[new TextRun({text:(p.heading||'ตาราง Comply TOR')+' '+project.name,font:p.font,size:28,bold:true})]}));
  if(p.headerText)children.push(new Paragraph({text:p.headerText}));
  children.push(new Table({width:{size:usable,type:WidthType.DXA},rows:[header,...rows]}));
  const document=new Document({sections:[{properties:{page:{size:{width:Math.round(p.pageWidth*20),height:Math.round(p.pageHeight*20)},margin:{top:600,right:600,bottom:600,left:600}}},children,footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({children:['หน้า ',PageNumber.CURRENT,' / ',PageNumber.TOTAL_PAGES]})]})]})}}]});
  return Packer.toBlob(document);
}

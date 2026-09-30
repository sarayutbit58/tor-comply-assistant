import {DEFAULT_PROFILE,guessField,validateProfile} from './tableModel.mjs';
import {readOffice,nodes,attr,textOf} from './officeXml';
function columns(headers,widths) {return headers.map((heading,i)=>({heading:heading||'คอลัมน์ '+(i+1),field:guessField(heading,i),width:widths[i]||100/headers.length}));}
function color(value,fallback) {return /^[a-f0-9]{6}$/i.test(value||'')?value.toUpperCase():fallback;}
export async function readTemplate(file,options={}) {
  const format=file.name.split('.').pop().toLowerCase();
  const profile=structuredClone(DEFAULT_PROFILE);
  let native={}, notices=[];
  if(format==='docx') {
    const {xml,archive}=options.office||await readOffice(file), doc=xml('word/document.xml');
    if(!doc) throw new Error('ไม่พบเนื้อหา DOCX');
    const tables=nodes(doc,'tbl');
    const tableIndex=options.tableIndex??tables.findIndex(t=>nodes(t,'tr').some(row=>nodes(row,'tc').length>=2));
    if(tableIndex<0) throw new Error('แม่แบบ DOCX ต้องมีตาราง');
    const table=tables[tableIndex],rows=[...table.children].filter(node=>node.localName==='tr');
    let headerRow=rows.findIndex(row=>/อ้างอิง|เสนอ|requirement|reference/i.test(textOf(row)));
    if(headerRow<0)headerRow=0;
    if(Number.isInteger(options.headerRow))headerRow=options.headerRow;
    const cells=[...rows[headerRow].children].filter(n=>n.localName==='tc');
    const widths=nodes(table,'gridCol').map(n=>Number(attr(n,'w')));
    profile.columns=columns(cells.map(textOf),widths.length===cells.length?widths:[]);
    const fonts=nodes(rows[headerRow],'rFonts')[0];
    profile.font=attr(fonts,'ascii')||profile.font;
    const size=Number(attr(nodes(rows[headerRow],'sz')[0],'val'));
    if(size>=14&&size<=48)profile.fontSize=size/2;
    profile.headerFill=color(attr(nodes(rows[headerRow],'shd')[0],'fill'),'FFFFFF');
    profile.headerColor=color(attr(nodes(rows[headerRow],'color')[0],'val'),'262629');
    profile.borderColor=color(attr(nodes(table,'top')[0],'color'),'888888');
    const pg=nodes(doc,'pgSz')[0];
    if(pg){profile.pageWidth=Number(attr(pg,'w'))/20;profile.pageHeight=Number(attr(pg,'h'))/20;}
    const body=nodes(doc,'body')[0];
    const headerPath=Object.keys(archive).find(path=>/^word\/header\d+\.xml$/.test(path));
    const footerPath=Object.keys(archive).find(path=>/^word\/footer\d+\.xml$/.test(path));
    profile.headerText=[headerPath?textOf(xml(headerPath)):'',...[...body.children].filter(n=>n.localName==='p').map(textOf)].filter(Boolean).slice(0,4).join('\n').slice(0,600);
    profile.footerText=footerPath?textOf(xml(footerPath)).slice(0,300):'';
    const headerDoc=headerPath?xml(headerPath):null;
    const blip=headerDoc?nodes(headerDoc,'blip')[0]:null;
    const embed=blip?.getAttribute('r:embed');
    if(embed){
      const relPath='word/_rels/'+headerPath.split('/').pop()+'.rels';
      const rels=xml(relPath),target=rels?nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===embed)?.getAttribute('Target'):null;
      const asset=target?archive['word/'+target.replace(/^\.\.\//,'')]:null;
      if(asset&&/\.(png|jpe?g)$/i.test(target)){
        const bitmap=await createImageBitmap(new Blob([asset]));
        const canvas=document.createElement('canvas');canvas.width=Math.min(360,bitmap.width);canvas.height=Math.round(bitmap.height*canvas.width/bitmap.width);
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        profile.logo=canvas.toDataURL('image/png');profile.logoRatio=canvas.height/canvas.width;
      }
    }
    native={tableIndex,headerRow};
    notices.push('DOCX จะรักษาตาราง หัว–ท้ายหน้า และรูปภาพในแม่แบบเดิม; ตรวจข้อความส่วนหัวก่อนส่งออก');
  } else if(format==='xlsx') {
    const {xml}=options.office||await readOffice(file), sheet=xml(options.sheetPath||'xl/worksheets/sheet1.xml'), styles=xml('xl/styles.xml'), shared=xml('xl/sharedStrings.xml');
    if(!sheet)throw new Error('ไม่พบแผ่นงานแรกใน XLSX');
    const strings=shared?nodes(shared,'si').map(textOf):[];
    const rows=nodes(sheet,'row');
    const cellText=cell=>cell.getAttribute('t')==='s'?strings[Number(nodes(cell,'v')[0]?.textContent)]||'':cell.getAttribute('t')==='inlineStr'?textOf(cell):nodes(cell,'v')[0]?.textContent||'';
    let row=options.xlsxTable?rows[options.xlsxTable.headerRow]:rows.find(r=>/อ้างอิง|เสนอ|requirement|reference/i.test(nodes(r,'c').map(cellText).join(' ')))||rows.find(r=>nodes(r,'c').length>=2);
    if(!row)throw new Error('ไม่พบหัวตารางในแผ่นงานแรก');
    const cells=nodes(row,'c'), widths=nodes(sheet,'col').map(n=>Number(n.getAttribute('width')));
    profile.columns=columns(cells.map(cellText),widths);
    if(options.xlsxTable)profile.columns=columns(options.xlsxTable.headers,options.xlsxTable.headers.map((_,i)=>{
      const physical=i+options.xlsxTable.columnOffset+1;
      const col=nodes(sheet,'col').find(n=>Number(n.getAttribute('min'))<=physical&&Number(n.getAttribute('max'))>=physical);
      return Number(col?.getAttribute('width'))||20;
    }));
    if(styles){
      const xfs=nodes(styles,'cellXfs')[0]?.children;
      const xf=xfs?.[Number(cells[0].getAttribute('s')||0)];
      const font=nodes(styles,'fonts')[0]?.children[Number(xf?.getAttribute('fontId')||0)];
      const fill=nodes(styles,'fills')[0]?.children[Number(xf?.getAttribute('fillId')||0)];
      profile.font=nodes(font||styles,'name')[0]?.getAttribute('val')||profile.font;
      profile.fontSize=Math.min(24,Math.max(7,Number(nodes(font||styles,'sz')[0]?.getAttribute('val')||10)));
      profile.headerColor=color(nodes(font||styles,'color')[0]?.getAttribute('rgb')?.slice(-6),'262629');
      profile.headerFill=color(nodes(fill||styles,'fgColor')[0]?.getAttribute('rgb')?.slice(-6),'FFFFFF');
    }
    notices.push('ใช้หัวตารางและรูปแบบจากแผ่นงานแรก; ส่งออกเป็นตารางกรองได้โดยไม่รวมเซลล์ข้อมูล');
  } else if(format==='pdf') {
    profile.headerFill='FFFFFF';profile.headerColor='262629';profile.borderColor='777777';
    const {loadPdf,extractPdf,paintPage}=await import('./pdfBrowser');
    const pages=options.pdfPages||await extractPdf(file,1),pageNumber=options.pdfSource?.page||1,first=pages.find(p=>p.page===pageNumber)||pages[0];
    const pdf=await loadPdf(file);
    try {
      const pg=await pdf.getPage(pageNumber),vp=pg.getViewport({scale:1});
      profile.pageWidth=vp.width;profile.pageHeight=vp.height;
      const anchors=first.items.filter(item=>/รายละเอียด|เอกสารอ้างอิง|เปรียบเทียบ|ลำดับ|เลขข้อ|requirement|propos|reference|result|comparison|status|clause|\bno\b/i.test(item.text)&&item.box[1]<.4);
      if(anchors.length>=3||options.pdfSource){
        const y=options.pdfSource?.top??Math.min(...anchors.map(a=>a.box[1]));
        const headerItems=(options.pdfSource?first.items.filter(a=>a.box[1]>=options.pdfSource.top-.002&&a.box[1]<options.pdfSource.bottom):anchors.filter(a=>Math.abs(a.box[1]-y)<.035)).sort((a,b)=>a.box[0]-b.box[0]);
        const groups=[];
        for(const item of headerItems){const group=groups.find(g=>Math.abs(g.x-item.box[0])<.035);if(group)group.text+=' '+item.text;else groups.push({x:item.box[0],text:item.text});}
        if(options.pdfSource)profile.columns=columns(options.pdfSource.headers,options.pdfSource.edges.slice(0,-1).map((x,i)=>(options.pdfSource.edges[i+1]-x)*100));
        else if(groups.length>=3)profile.columns=columns(groups.map(g=>g.text),groups.map((g,i)=>((groups[i+1]?.x||.96)-g.x)*100));
        if(y>.03){
          const canvas=document.createElement('canvas');await paintPage(pdf,pageNumber,canvas,1.5);
          const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
          const histogram=new Map();
          const topY=Math.max(0,Math.floor((options.pdfSource?options.pdfSource.top+.003:y-.006)*canvas.height));
          const bottomY=Math.min(canvas.height,Math.ceil((options.pdfSource?options.pdfSource.bottom-.003:Math.max(...headerItems.map(i=>i.box[1]+i.box[3]))+.006)*canvas.height));
          const leftX=Math.max(0,Math.floor((Math.min(...headerItems.map(i=>i.box[0]))-.008)*canvas.width));
          const rightX=Math.min(canvas.width,Math.ceil(Math.max(...headerItems.map(i=>i.box[0]+i.box[2]))*canvas.width));
          for(let py=topY;py<bottomY;py+=2)for(let px=leftX;px<rightX;px+=3){
            const offset=(py*canvas.width+px)*4;
            const hex=[pixels.data[offset],pixels.data[offset+1],pixels.data[offset+2]].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
            histogram.set(hex,(histogram.get(hex)||0)+1);
          }
          const fill=[...histogram].sort((a,b)=>b[1]-a[1])[0]?.[0];
          if(fill){
            profile.headerFill=fill;
            const luminance=.299*parseInt(fill.slice(0,2),16)+.587*parseInt(fill.slice(2,4),16)+.114*parseInt(fill.slice(4,6),16);
            profile.headerColor=luminance<140?'FFFFFF':'262629';
          }
          const top=document.createElement('canvas');top.width=canvas.width;top.height=Math.floor(canvas.height*Math.max(0,y-.015));
          top.getContext('2d').drawImage(canvas,0,0,top.width,top.height,0,0,top.width,top.height);
          profile.banner=top.toDataURL('image/png');profile.bannerRatio=top.height/top.width;
        }
      } else notices.push('ยังอ่านหัวตาราง PDF ไม่ครบ กรุณากำหนดหัวคอลัมน์ในตัวอย่างก่อนใช้งาน');
    } finally {await pdf.destroy();}
    notices.push('PDF ใช้ขนาดหน้าและส่วนหัวจากต้นฉบับ แล้วจัดตารางใหม่; ตำแหน่งอาจต่างจากแม่แบบ');
  } else throw new Error('แม่แบบรองรับ DOCX, PDF หรือ XLSX');
  if(options.intake) {
    const originalCount=profile.columns.length;
    for(const field of ['proposal','comparison','references'])if(!profile.columns.some(c=>c.field===field))profile.columns.push(structuredClone(DEFAULT_PROFILE.columns.find(c=>c.field===field)));
    if(profile.columns.length!==originalCount){native.rebuildTable=true;notices.push('เพิ่มคอลัมน์คำตอบ/ผล/อ้างอิงที่ไม่มีในต้นฉบับ การส่งออกจะจัดตารางใหม่ตามรูปแบบหลัก');}
    // The user confirms the source TOR column in the intake preview.
    if(!profile.columns.some(c=>c.field==='requirement'))profile.columns[Math.min(1,originalCount-1)].field='requirement';
  }
  if(!options.sourceRead)validateProfile(profile);
  return {format,profile,native,notices};
}

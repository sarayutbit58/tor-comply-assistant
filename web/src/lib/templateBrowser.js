import {DEFAULT_PROFILE,guessField,validateProfile} from './tableModel.mjs';
import {readOffice,nodes,attr,textOf} from './officeXml';
function columns(headers,widths) {return headers.map((heading,i)=>({heading:heading||'คอลัมน์ '+(i+1),field:guessField(heading,i),width:widths[i]||100/headers.length}));}
function color(value,fallback) {return /^[a-f0-9]{6}$/i.test(value||'')?value.toUpperCase():fallback;}
export async function readTemplate(file) {
  const format=file.name.split('.').pop().toLowerCase();
  const profile=structuredClone(DEFAULT_PROFILE);
  let native={}, notices=[];
  if(format==='docx') {
    const {xml}=await readOffice(file), doc=xml('word/document.xml');
    if(!doc) throw new Error('ไม่พบเนื้อหา DOCX');
    const tables=nodes(doc,'tbl');
    const tableIndex=tables.findIndex(t=>nodes(t,'tr').some(row=>nodes(row,'tc').length>=2));
    if(tableIndex<0) throw new Error('แม่แบบ DOCX ต้องมีตาราง');
    const table=tables[tableIndex],rows=nodes(table,'tr');
    let headerRow=rows.findIndex(row=>/อ้างอิง|เสนอ|requirement|reference/i.test(textOf(row)));
    if(headerRow<0)headerRow=0;
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
    profile.headerText=[...body.children].filter(n=>n.localName==='p').map(textOf).filter(Boolean).slice(0,4).join('\n').slice(0,600);
    native={tableIndex,headerRow};
    notices.push('DOCX จะรักษาตาราง หัว–ท้ายหน้า และรูปภาพในแม่แบบเดิม; ตรวจข้อความส่วนหัวก่อนส่งออก');
  } else if(format==='xlsx') {
    const {xml}=await readOffice(file), sheet=xml('xl/worksheets/sheet1.xml'), styles=xml('xl/styles.xml'), shared=xml('xl/sharedStrings.xml');
    if(!sheet)throw new Error('ไม่พบแผ่นงานแรกใน XLSX');
    const strings=shared?nodes(shared,'si').map(textOf):[];
    const rows=nodes(sheet,'row');
    const cellText=cell=>cell.getAttribute('t')==='s'?strings[Number(nodes(cell,'v')[0]?.textContent)]||'':cell.getAttribute('t')==='inlineStr'?textOf(cell):nodes(cell,'v')[0]?.textContent||'';
    let row=rows.find(r=>/อ้างอิง|เสนอ|requirement|reference/i.test(nodes(r,'c').map(cellText).join(' ')))||rows.find(r=>nodes(r,'c').length>=2);
    if(!row)throw new Error('ไม่พบหัวตารางในแผ่นงานแรก');
    const cells=nodes(row,'c'), widths=nodes(sheet,'col').map(n=>Number(n.getAttribute('width')));
    profile.columns=columns(cells.map(cellText),widths);
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
    const {loadPdf,extractPdf,paintPage}=await import('./pdfBrowser');
    const pages=await extractPdf(file), first=pages[0];
    const pdf=await loadPdf(file);
    try {
      const pg=await pdf.getPage(1),vp=pg.getViewport({scale:1});
      profile.pageWidth=vp.width;profile.pageHeight=vp.height;
      const anchors=first.items.filter(item=>/รายละเอียด|เอกสารอ้างอิง|เปรียบเทียบ|ลำดับ/.test(item.text)&&item.box[1]<.4);
      if(anchors.length>=3){
        const y=Math.min(...anchors.map(a=>a.box[1]));
        const headerItems=anchors.filter(a=>Math.abs(a.box[1]-y)<.065).sort((a,b)=>a.box[0]-b.box[0]);
        const groups=[];
        for(const item of headerItems){const group=groups.find(g=>Math.abs(g.x-item.box[0])<.09);if(group)group.text+=' '+item.text;else groups.push({x:item.box[0],text:item.text});}
        if(groups.length>=3)profile.columns=columns(groups.map(g=>g.text),groups.map((g,i)=>((groups[i+1]?.x||.96)-g.x)*100));
        if(y>.03){
          const canvas=document.createElement('canvas');await paintPage(pdf,1,canvas,1.5);
          const top=document.createElement('canvas');top.width=canvas.width;top.height=Math.floor(canvas.height*Math.max(0,y-.015));
          top.getContext('2d').drawImage(canvas,0,0,top.width,top.height,0,0,top.width,top.height);
          profile.banner=top.toDataURL('image/png');profile.bannerRatio=top.height/top.width;
        }
      } else notices.push('ยังอ่านหัวตาราง PDF ไม่ครบ กรุณากำหนดหัวคอลัมน์ในตัวอย่างก่อนใช้งาน');
    } finally {await pdf.destroy();}
    profile.headerFill='FFFFFF';profile.headerColor='262629';profile.borderColor='777777';
    notices.push('PDF ใช้ขนาดหน้าและส่วนหัวจากต้นฉบับ แล้วจัดตารางใหม่; ตำแหน่งอาจต่างจากแม่แบบ');
  } else throw new Error('แม่แบบรองรับ DOCX, PDF หรือ XLSX');
  validateProfile(profile);
  return {format,profile,native,notices};
}

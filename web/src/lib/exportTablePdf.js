import {profileFor,tableRows} from './tableModel.mjs';
export async function exportTablePdf(project) {
  const [{PDFDocument,StandardFonts,rgb},fontkit]=await Promise.all([import('pdf-lib'),import('@pdf-lib/fontkit')]);
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit.default||fontkit);
  const fontResponse=await fetch('/fonts/NotoSansThai-Regular.ttf');
  if(!fontResponse.ok)throw new Error('โหลดฟอนต์ PDF ไม่สำเร็จ');
  const thai=await pdf.embedFont(await fontResponse.arrayBuffer(),{subset:true}),latin=pdf.embedStandardFont(StandardFonts.Helvetica);
  const profile=profileFor(project),size=profile.fontSize,leading=size*1.6,margin=profile.margin||30;
  const color=hex=>rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255);
  const runs=text=>{
    const normalized=String(text).replace(/[๐-๙]/g,d=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/[–—]/g,'-').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/·|•/g,'-');
    const result=[];
    for(const char of normalized){
      const font=/[\u0e00-\u0e7f]/u.test(char)?thai:latin;
      const safe=font===latin&&!/[\x20-\x7e\xa0-\xff]/.test(char)?' ':char;
      const last=result[result.length-1];if(last?.font===font)last.text+=safe;else result.push({font,text:safe});
    }return result;
  };
  const width=text=>runs(text).reduce((sum,r)=>sum+r.font.widthOfTextAtSize(r.text,size),0);
  const draw=(text,x,y,fill='262629')=>{for(const run of runs(text)){pdfPage.drawText(run.text,{x,y,size,font:run.font,color:color(fill)});x+=run.font.widthOfTextAtSize(run.text,size);}};
  const segmenter=new Intl.Segmenter('th',{granularity:'word'}),graphemes=new Intl.Segmenter('th',{granularity:'grapheme'});
  const wrap=(text,max)=>{
    const lines=[];
    for(const paragraph of String(text||' ').split('\n')){
      let line='';
      for(const {segment} of segmenter.segment(paragraph)){
        if(width(line+segment)<=max){line+=segment;continue;}
        if(line){lines.push(line.trimEnd());line='';}
        if(width(segment)>max){for(const {segment:g}of graphemes.segment(segment)){if(width(line+g)>max&&line){lines.push(line);line='';}line+=g;}}else line=segment.trimStart();
      }lines.push(line||' ');
    }return lines;
  };
  const total=profile.columns.reduce((n,c)=>n+c.width,0),usable=profile.pageWidth-2*margin;
  const widths=profile.columns.map(c=>usable*c.width/total);
  const headings=profile.columns.map((c,i)=>wrap(c.heading,widths[i]-10));
  let pdfPage,y,pageNumber=0;
  let banner;
  if(profile.banner)banner=await pdf.embedPng(profile.banner);
  function paintCells(cellLines,count,offset,header=false){
    const height=count*leading+12;let x=margin;
    for(let c=0;c<widths.length;c++){
      pdfPage.drawRectangle({x,y:y-height,width:widths[c],height,borderColor:color(profile.borderColor),borderWidth:.5,color:header?color(profile.headerFill):rgb(1,1,1)});
      cellLines[c].slice(offset,offset+count).forEach((line,index)=>draw(line,x+5,y-8-size-index*leading,header?profile.headerColor:'262629'));
      x+=widths[c];
    }y-=height;
  }
  function newPage(){
    pdfPage=pdf.addPage([profile.pageWidth,profile.pageHeight]);pageNumber++;y=profile.pageHeight-margin;
    if(banner){const h=Math.min(profile.pageHeight*.22,usable*profile.bannerRatio);pdfPage.drawImage(banner,{x:margin,y:y-h,width:usable,height:h});y-=h+8;}
    for(const line of wrap((profile.heading||'ตาราง Comply TOR')+' · '+project.name,usable)){draw(line,margin,y-size);y-=leading;}
    if(profile.headerText)for(const line of wrap(profile.headerText,usable).slice(0,5)){draw(line,margin,y-size);y-=leading;}
    y-=8;
    paintCells(headings,Math.max(...headings.map(l=>l.length)),0,true);
  }
  newPage();
  for(const row of tableRows(project)){
    const lines=row.map((value,i)=>wrap(value,widths[i]-10)),length=Math.max(...lines.map(l=>l.length));
    let offset=0;
    while(offset<length){
      let available=Math.floor((y-margin-30-12)/leading);
      if(available<1){newPage();available=Math.floor((y-margin-30-12)/leading);}
      if(available<1)throw new Error('ส่วนหัวแม่แบบสูงเกินไป ลดขนาดตัวอักษรหรือข้อความส่วนหัว');
      const count=Math.min(available,length-offset);paintCells(lines,count,offset);offset+=count;
      if(offset<length)newPage();
    }
  }
  const pages=pdf.getPages();
  pages.forEach((page,index)=>{pdfPage=page;draw('หน้า '+(index+1)+' / '+pages.length,margin,16);});
  return new Blob([await pdf.save()],{type:'application/pdf'});
}

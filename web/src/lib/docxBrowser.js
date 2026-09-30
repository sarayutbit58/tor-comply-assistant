import { parseDocxBlocks } from './torModel.mjs';
import { allowDocxEntry, MAX_DOCX_XML, MAX_DOCX_NUMBERING_XML } from './docxLimits.mjs';
import {applyDocxNumbering,MAX_NUMBERING_RECORDS} from './docxNumbering.mjs';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const direct = (node,name) => [...(node?.children || [])].filter(child => child.namespaceURI===wordNamespace && child.localName===name);
const attribute = (node,name) => node?.getAttributeNS(wordNamespace,name) ?? node?.getAttribute('w:'+name);
const first = (node,name) => direct(node,name)[0];
function paragraphText(node) {
  if (node.namespaceURI===wordNamespace) {
    if (node.localName==='t') return node.textContent || '';
    if (['br','cr'].includes(node.localName)) return '\n';
    if (node.localName==='tab') return ' ';
  }
  return [...node.childNodes].filter(child => child.nodeType===1).map(paragraphText).join('');
}
function readParagraph(node) {
  const numPr=first(first(node,'pPr'),'numPr');
  return {text:paragraphText(node),numId:attribute(first(numPr,'numId'),'val'),level:Number(attribute(first(numPr,'ilvl'),'val') || 0),styleId:attribute(first(first(node,'pPr'),'pStyle'),'val')};
}
function parseXml(bytes,strFromU8) {
  const document=new DOMParser().parseFromString(strFromU8(bytes),'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('อ่านโครงสร้าง DOCX ไม่สำเร็จ');
  return document;
}
function readLevel(node) {
  const restart=attribute(first(node,'lvlRestart'),'val');
  return {level:Number(attribute(node,'ilvl')),start:Number(attribute(first(node,'start'),'val') ?? 1),format:attribute(first(node,'numFmt'),'val'),pattern:attribute(first(node,'lvlText'),'val'),styleId:attribute(first(node,'pStyle'),'val'),...(restart!==null && restart!==undefined ? {restart:Number(restart)} : {})};
}
function numberingModel(document) {
  if (!document) return {abstracts:[],instances:[]};
  const root=document.documentElement, abstracts=direct(root,'abstractNum'), instances=direct(root,'num');
  if (abstracts.length>MAX_NUMBERING_RECORDS || instances.length>MAX_NUMBERING_RECORDS) throw new Error('จำนวนลำดับ DOCX เกินขนาดที่รองรับ');
  return {
    abstracts:abstracts.map(node=>({id:attribute(node,'abstractNumId'),levels:direct(node,'lvl').map(readLevel),styleLinked:Boolean(first(node,'numStyleLink') || first(node,'styleLink'))})),
    instances:instances.map(node=>({id:attribute(node,'numId'),abstractId:attribute(first(node,'abstractNumId'),'val'),overrides:direct(node,'lvlOverride').map(value=>{
      const start=attribute(first(value,'startOverride'),'val'),definition=first(value,'lvl');
      return {level:Number(attribute(value,'ilvl')),...(start!==null && start!==undefined ? {start:Number(start)} : {}),...(definition ? {definition:readLevel(definition)} : {})};
    })})),
  };
}

export async function extractDocx(file) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: allowDocxEntry });
  const content = archive['word/document.xml'];
  if (!content) throw new Error('ไฟล์ DOCX ไม่มี word/document.xml');
  if (content.length > MAX_DOCX_XML) throw new Error('เนื้อหา DOCX ใหญ่เกินไป');
  const document = parseXml(content,strFromU8);
  const numbering=archive['word/numbering.xml'];
  if (numbering?.length>MAX_DOCX_NUMBERING_XML) throw new Error('เนื้อหา DOCX ใหญ่เกินไป');
  const model=numberingModel(numbering ? parseXml(numbering,strFromU8) : null);

  const body = document.getElementsByTagNameNS(wordNamespace, 'body')[0];
  if (!body) throw new Error('ไฟล์ DOCX ไม่มีเนื้อหาเอกสาร');
  const blocks = [], paragraphs=[], warnings=[];
  const capture = node => {const index=paragraphs.length;paragraphs.push(readParagraph(node));return index;};
  for (const child of body.childNodes) {
    if (child.nodeType !== 1) continue;
    if (child.localName === 'p') blocks.push({ type: 'paragraph', paragraph:capture(child) });
    if (child.localName === 'tbl') {
      for (const row of direct(child,'tr')) {
        const cells = direct(row,'tc');
        if (cells.some(cell=>cell.getElementsByTagNameNS(wordNamespace,'tbl').length)) warnings.push('พบตารางซ้อนใน DOCX อ่านเฉพาะแถวและข้อความของตารางหลัก โปรดตรวจข้อความจากตารางซ้อนเอง');
        blocks.push({ type: 'tableRow', cells: cells.map(cell => direct(cell,'p').map(capture)) });
      }
    }
  }
  const numbered=applyDocxNumbering(paragraphs,model);
  const plain=blocks.map(block=>block.type==='paragraph' ? {type:'paragraph',text:numbered.paragraphs[block.paragraph].text} : {type:'tableRow',cells:block.cells.map(indexes=>indexes.map(index=>numbered.paragraphs[index].text).join('\n'))});
  const parsed=parseDocxBlocks(plain);
  return {...parsed,requirements:parsed.requirements.map(req=>({...req,sourcePage:null,sourcePages:[],sourceRegions:[]})),warnings:[...new Set([...warnings,...numbered.warnings])]};
}

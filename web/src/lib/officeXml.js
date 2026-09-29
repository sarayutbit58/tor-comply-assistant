export const WORD_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const SHEET_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const nodes=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
export const attr=(node,name)=>node?.getAttributeNS(WORD_NS,name)||node?.getAttribute(name)||node?.getAttribute('w:'+name);
export const textOf=node=>nodes(node,'t').map(n=>n.textContent||'').join('');
export function parseXml(value) {
  const doc=new DOMParser().parseFromString(value,'application/xml');
  if(nodes(doc,'parsererror').length) throw new Error('โครงสร้างเอกสาร XML ไม่ถูกต้อง');
  return doc;
}
export async function readOffice(blob) {
  const {unzipSync,strFromU8}=await import('fflate');
  let total=0;
  const archive=unzipSync(new Uint8Array(await blob.arrayBuffer()),{filter:entry=>{
    total+=entry.originalSize;
    if(total>60*1024*1024||entry.originalSize>15*1024*1024) throw new Error('เนื้อหาแม่แบบใหญ่เกินขนาด');
    return true;
  }});
  return {archive,xml:path=>archive[path]?parseXml(strFromU8(archive[path])):null};
}

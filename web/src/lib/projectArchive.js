import { getFile, putFile, deleteFile } from './localFiles';
import { projectFileIds } from './projectModel.mjs';
import { ARCHIVE_VERSION, MAX_ARCHIVE_BYTES, validateManifest, remapProject } from './archiveModel.mjs';
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function exportProjectArchive(project) {
  const { zip, strToU8 } = await import('fflate');
  const entries = {}, files = [];
  let total = 0;
  for (const [i,id] of projectFileIds(project).entries()) {
    const file = await getFile(id);
    if (!file) throw new Error('ไฟล์ต้นฉบับไม่ครบ จึงไม่สามารถส่งออกโครงการสมบูรณ์ได้');
    total += file.blob.size;
    if (total > MAX_ARCHIVE_BYTES) throw new Error('ไฟล์รวมเกิน 160 MB');
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const path = 'files/'+i+'.bin', metaPath = 'metadata/'+i+'.json';
    entries[path] = [bytes,{level:0}];
    entries[metaPath] = strToU8(JSON.stringify({pageTexts:file.pageTexts,pages:file.pages}));
    files.push({id,path,metaPath,size:bytes.length,type:file.blob.type,sha256:await hash(bytes)});
  }
  entries['manifest.json'] = strToU8(JSON.stringify({format:'tor-comply-project',version:ARCHIVE_VERSION,project,files}));
  const bytes = await new Promise((resolve,reject)=>zip(entries,{level:1},(error,data)=>error?reject(error):resolve(data)));
  return new Blob([bytes],{type:'application/zip'});
}
export async function importProjectArchive(file) {
  if (file.size > MAX_ARCHIVE_BYTES + 15*1024*1024) throw new Error('ไฟล์โครงการใหญ่เกินขนาดที่รองรับ');
  const { unzipSync, strFromU8 } = await import('fflate');
  const input = new Uint8Array(await file.arrayBuffer());
  let total = 0;
  const entries = unzipSync(input,{filter: entry=>{
    total += entry.originalSize;
    if (total > MAX_ARCHIVE_BYTES+20*1024*1024 || entry.originalSize > MAX_ARCHIVE_BYTES) throw new Error('ข้อมูลที่ขยายจาก ZIP ใหญ่เกินขนาด');
    return entry.name==='manifest.json'||/^files\/\d+\.bin$/.test(entry.name)||/^metadata\/\d+\.json$/.test(entry.name);
  }});
  if (!entries['manifest.json'] || entries['manifest.json'].length>10*1024*1024) throw new Error('ไม่พบข้อมูลโครงการที่ถูกต้อง');
  const manifest = JSON.parse(strFromU8(entries['manifest.json']));
  const original = validateManifest(manifest);
  const {project,mapping} = remapProject(original,()=>crypto.randomUUID());
  const staged = [];
  try {
    for (const entry of manifest.files) {
      const bytes = entries[entry.path], meta = entries[entry.metaPath];
      if (!bytes || !meta || bytes.length!==entry.size || await hash(bytes)!==entry.sha256) throw new Error('ไฟล์แนบเสียหายหรือไม่ครบ');
      const metadata = JSON.parse(strFromU8(meta));
      if (!Array.isArray(metadata.pageTexts) || !Array.isArray(metadata.pages)) throw new Error('ข้อมูลหน้าเอกสารเสียหาย');
      await putFile(mapping[entry.id],new Blob([bytes],{type:entry.type}),metadata.pageTexts,metadata.pages);
      staged.push(mapping[entry.id]);
    }
    return {project, rollback:()=>Promise.all(staged.map(deleteFile))};
  } catch(error) { await Promise.all(staged.map(deleteFile)); throw error; }
}

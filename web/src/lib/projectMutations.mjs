import {STATUS, emptyResponse, eligibleDocument, linkedRequirements, selectedItems, validateMark} from './projectModel.mjs';
import {uniqueRequirements} from './torModel.mjs';

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const badControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
function record(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
}
function fields(patch, allowed) {
  record(patch, 'ข้อมูลที่แก้ไขไม่ถูกต้อง');
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('ข้อมูลนี้ไม่อนุญาตให้แก้ไข');
}
function text(value, label, required = false, limit = 120000) {
  if (typeof value !== 'string' || badControls.test(value)) throw new Error(label + 'ไม่ถูกต้อง');
  const clean = value.trim();
  if ((required && !clean) || clean.length > limit) throw new Error('กรุณาระบุ' + label + 'ให้ถูกต้อง');
  return clean;
}
function find(collection, id, label) {
  const found = collection.find(item => item.id === id);
  if (!found) throw new Error('ไม่พบ' + label);
  return found;
}
function ids(value, label) {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id)) throw new Error(label + 'ไม่ถูกต้อง');
  return [...new Set(value)];
}
function pageNumber(value) {
  if (!Number.isInteger(value) || value < 1) throw new Error('หน้าเอกสารไม่ถูกต้อง');
  return value;
}
function boxValue(value) {
  if (!Array.isArray(value) || value.length !== 4 || value.some(n => !Number.isFinite(n))) throw new Error('กรอบไฮไลต์ไม่ถูกต้อง');
  const [x,y,w,h] = value;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x+w > 1.001 || y+h > 1.001) throw new Error('กรอบไฮไลต์ไม่ถูกต้อง');
  return [...value];
}
function physicalPages(requirement) {
  return [...new Set([requirement.sourcePage,...(requirement.sourcePages || [])].filter(page => Number.isInteger(page) && page > 0))];
}
function sourceProvenance(requirement) {
  const next = {...requirement};
  if (next.sourcePage!==null && next.sourcePage!==undefined) pageNumber(next.sourcePage);
  if (has(next,'sourcePages')) {
    if (!Array.isArray(next.sourcePages)) throw new Error('หน้า TOR ต้นฉบับไม่ถูกต้อง');
    next.sourcePages = [...new Set(next.sourcePages.map(pageNumber))];
  }
  if (has(next,'sourceRegions')) {
    if (!Array.isArray(next.sourceRegions)) throw new Error('กรอบ TOR ต้นฉบับไม่ถูกต้อง');
    next.sourceRegions = next.sourceRegions.map(region => {
      record(region,'กรอบ TOR ต้นฉบับไม่ถูกต้อง');
      return {page:pageNumber(region.page),box:boxValue(region.box)};
    });
  }
  return next;
}
function reopenedPages(project, touched) {
  const resolutions = project.sourcePageResolutions || [];
  const pages = resolutions.filter(entry => touched.includes(entry.page)).map(entry => entry.page);
  const affected = project.requirements.filter(req => physicalPages(req).some(page => pages.includes(page))).map(req => req.id);
  return {pages,affected,patch:pages.length ? {unreadablePages:[...new Set([...(project.unreadablePages || []),...pages])].sort((a,b)=>a-b),sourcePageResolutions:resolutions.filter(entry => !pages.includes(entry.page))} : {}};
}
function invalidateRows(rows, affected) {
  const selected = new Set(affected);
  return Object.fromEntries(Object.entries(rows).map(([id,row]) => [id, selected.has(id) ? {...row,comparison:STATUS.pending,assessment:null,decisionSource:null} : row]));
}
function documentClauses(project, docIds) {
  const selected = new Set(docIds);
  return project.evidence.filter(mark => selected.has(mark.docId)).flatMap(linkedRequirements);
}
function offeringClauses(project, itemIds) {
  const selected = new Set(itemIds);
  return Object.entries(project.rows).filter(([,row]) => selectedItems(row).some(id => selected.has(id))).map(([id]) => id);
}
function associations(project, document) {
  if (!eligibleDocument(document)) throw new Error('ประเภทเอกสารหลักฐานไม่ถูกต้อง');
  const itemIds = ids(document.itemIds, 'รายการของเอกสาร');
  if (document.role === 'bidder') {
    if (itemIds.length) throw new Error('หลักฐานคุณสมบัติผู้ยื่นข้อเสนอไม่ผูกกับรายการสินค้า/บริการ');
  } else {
    if (!itemIds.length) throw new Error('เลือกสินค้า/บริการของเอกสารอย่างน้อยหนึ่งรายการ');
    for (const id of itemIds) {
      const item = find(project.products, id, 'สินค้า/บริการที่เลือก');
      if ((item.kind || 'product') !== document.role) throw new Error('ประเภทสินค้า/บริการไม่ตรงกับประเภทเอกสาร');
    }
  }
  return itemIds;
}

export function updateOffering(project, itemId, patch) {
  fields(patch,['kind','name','brand','model','provider','endpoints','bandwidth']);
  const current = find(project.products,itemId,'สินค้า/บริการ');
  const next = {...current,...patch,kind:has(patch,'kind') ? patch.kind : current.kind || 'product'};
  if (!['product','service'].includes(next.kind)) throw new Error('ประเภทสินค้า/บริการไม่ถูกต้อง');
  next.name = text(next.name,'ชื่อสินค้า/บริการ',true,160);
  for (const key of ['brand','model','provider','endpoints','bandwidth']) if (has(next,key)) next[key] = text(next[key],{brand:'ยี่ห้อ',model:'รุ่น',provider:'ผู้ให้บริการ',endpoints:'พื้นที่บริการ',bandwidth:'รายละเอียดบริการ'}[key],next.kind==='product' && ['brand','model'].includes(key),1000);
  if (next.kind === 'product' && (!next.brand || !next.model)) throw new Error('กรุณาระบุยี่ห้อและรุ่น');
  const linkedDocs = project.docs.filter(doc => (doc.itemIds || []).includes(itemId));
  if (linkedDocs.some(doc => doc.role !== 'bidder' && doc.role !== next.kind)) throw new Error('ประเภทสินค้า/บริการไม่ตรงกับเอกสารที่ผูกอยู่');
  const affected = [...offeringClauses(project,[itemId]),...documentClauses(project,linkedDocs.map(doc => doc.id))];
  return {...project,products:project.products.map(item => item.id===itemId ? next : item),rows:invalidateRows(project.rows,affected)};
}

export function removeOffering(project, itemId) {
  find(project.products,itemId,'สินค้า/บริการ');
  const linkedDocs = project.docs.filter(doc => (doc.itemIds || []).includes(itemId));
  const affected = [...offeringClauses(project,[itemId]),...documentClauses(project,linkedDocs.map(doc => doc.id))];
  const rows = Object.fromEntries(Object.entries(project.rows).map(([id,row]) => [id,{...row,itemIds:selectedItems(row).filter(item => item!==itemId)}]));
  return {...project,products:project.products.filter(item => item.id!==itemId),docs:project.docs.map(doc => ({...doc,itemIds:(doc.itemIds || []).filter(item => item!==itemId)})),rows:invalidateRows(rows,affected)};
}

export function updateDocumentMetadata(project, docId, patch) {
  fields(patch,['name','role','itemIds']);
  const current = find(project.docs,docId,'เอกสารหลักฐาน');
  const next = {...current,...patch};
  next.name = text(next.name,'ชื่อเอกสาร',true,240);
  next.itemIds = associations(project,next);
  const affected = [...documentClauses(project,[docId]),...offeringClauses(project,[...(current.itemIds || []),...next.itemIds])];
  if (current.role==='bidder' || next.role==='bidder') affected.push(...Object.entries(project.rows).filter(([,row]) => row.scope==='bidder').map(([id]) => id));
  return {...project,docs:project.docs.map(doc => doc.id===docId ? next : doc),rows:invalidateRows(project.rows,affected)};
}

export function removeDocumentMetadata(project, docId) {
  const document = find(project.docs,docId,'เอกสารหลักฐาน');
  const affected = [...documentClauses(project,[docId]),...offeringClauses(project,document.itemIds || [])];
  if (document.role==='bidder') affected.push(...Object.entries(project.rows).filter(([,row]) => row.scope==='bidder').map(([id]) => id));
  return {...project,docs:project.docs.filter(doc => doc.id!==docId),evidence:project.evidence.filter(mark => mark.docId!==docId),rows:invalidateRows(project.rows,affected)};
}

export function updateEvidenceMark(project, markId, patch) {
  fields(patch,['quote','printedPage','box','pdfPage','requirementIds','reviewed']);
  const current = find(project.evidence,markId,'จุดหลักฐาน');
  if (has(patch,'reviewed') && typeof patch.reviewed!=='boolean') throw new Error('สถานะตรวจหลักฐานไม่ถูกต้อง');
  const next = {...current,...patch};
  next.quote = text(next.quote,'ข้อความหลักฐาน',true);
  next.printedPage = text(next.printedPage ?? '', 'เลขหน้าที่พิมพ์',false,120);
  next.box = boxValue(next.box);
  next.requirementIds = ids(linkedRequirements(next),'ข้อ TOR ที่ผูกหลักฐาน');
  validateMark(project,next);
  const changed = next.quote!==current.quote || next.pdfPage!==current.pdfPage || next.box.some((n,i) => n!==current.box[i]);
  if (changed) {
    next.rawQuote = current.rawQuote ?? current.quote;
    next.sourceMethod = 'corrected';
    next.reviewed = false;
    next.keyword = next.quote.slice(0,80);
  }
  const affected = [...linkedRequirements(current),...next.requirementIds];
  return {...project,evidence:project.evidence.map(mark => mark.id===markId ? next : mark),rows:invalidateRows(project.rows,affected)};
}

export function resolveSourcePage(project, page, options) {
  pageNumber(page);
  fields(options,['confirmed','reason','kind','requirementIds']);
  if (!(project.unreadablePages || []).includes(page)) throw new Error('หน้า TOR นี้ไม่ได้รอการตรวจข้อความ');
  if (options.confirmed!==true) throw new Error('ยืนยันว่าเทียบทั้งหน้ากับต้นฉบับแล้ว');
  const reason = text(options.reason,'เหตุผลการยืนยันหน้า TOR',true,2000);
  const onPage = project.requirements.filter(req => physicalPages(req).includes(page));
  let requirementIds = ids(options.requirementIds || [],'ข้อ TOR ในหน้านี้');
  if (options.kind==='transcribed') {
    if (!onPage.length || requirementIds.length!==onPage.length || onPage.some(req => !requirementIds.includes(req.id))) throw new Error('ต้องระบุข้อ TOR ของหน้านี้ให้ครบ');
    if (onPage.some(req => !req.reviewed)) throw new Error('ตรวจและยืนยัน TOR ทุกข้อในหน้านี้ก่อน');
  } else if (options.kind==='no-requirements') {
    if (onPage.length || requirementIds.length) throw new Error('หน้านี้มีข้อ TOR ต้องตรวจข้อก่อน');
    requirementIds = [];
  } else throw new Error('ประเภทการยืนยันหน้า TOR ไม่ถูกต้อง');
  const resolution = {page,kind:options.kind,reason,requirementIds};
  return {...project,unreadablePages:project.unreadablePages.filter(n => n!==page),sourcePageResolutions:[...(project.sourcePageResolutions || []).filter(entry => entry.page!==page),resolution],rows:invalidateRows(project.rows,requirementIds)};
}

function requirementId(value) {
  const id = text(value,'เลขข้อ',true,120);
  if (['__proto__','constructor','prototype'].includes(id) || /[\u0000-\u001f]/u.test(id)) throw new Error('เลขข้อไม่ถูกต้อง');
  return id;
}
function correctionRecord(value, current, next) {
  if (value) fields(value,['method','page','box','reason']);
  const method = text(value && has(value,'method') ? value.method : 'manual','วิธีแก้ข้อความ',true,80);
  const page = value?.page ?? next.sourcePage ?? null;
  if (page!==null) pageNumber(page);
  const correction = {method,page,previousId:current.id,nextId:next.id,previousText:current.textSnapshot,nextText:next.textSnapshot};
  if (value?.box) correction.box = boxValue(value.box);
  if (value?.reason) correction.reason = text(value.reason,'เหตุผลการแก้ข้อความ',false,2000);
  return correction;
}

export function replaceRequirement(project, reqId, patch) {
  fields(patch,['id','title','textSnapshot','sourcePage','sourcePages','sourceRegions','sourceMethod','reviewed','sourceCorrection']);
  const current = find(project.requirements,reqId,'ข้อ TOR');
  if (has(patch,'reviewed') && typeof patch.reviewed!=='boolean') throw new Error('สถานะตรวจ TOR ไม่ถูกต้อง');
  const next = sourceProvenance({...current,...patch,id:has(patch,'id') ? requirementId(patch.id) : reqId});
  delete next.sourceCorrection;
  if (next.id!==reqId && project.requirements.some(req => req.id===next.id)) throw new Error('เลขข้อ TOR ซ้ำ');
  next.textSnapshot = text(next.textSnapshot,'ข้อความ TOR',true);
  if (has(patch,'sourceMethod') && !['text','table-text','manual','ocr','local-ocr','geometry','corrected'].includes(patch.sourceMethod)) throw new Error('วิธีอ่านข้อความ TOR ไม่ถูกต้อง');
  if (has(next,'title')) next.title = text(next.title,'หัวข้อ',false,1000);
  const changed = next.id!==reqId || next.textSnapshot!==current.textSnapshot || next.sourcePage!==current.sourcePage || next.title!==current.title || next.sourceMethod!==current.sourceMethod || JSON.stringify(next.sourcePages)!==JSON.stringify(current.sourcePages) || JSON.stringify(next.sourceRegions)!==JSON.stringify(current.sourceRegions) || Boolean(patch.sourceCorrection);
  if (changed) {
    const correction = correctionRecord(patch.sourceCorrection,current,next);
    next.rawTextSnapshot = current.rawTextSnapshot ?? current.textSnapshot;
    next.sourceCorrections = [...(current.sourceCorrections || []),correction];
    next.sourceMethod = 'corrected';
    next.reviewed = false;
  }
  if (next.id!==reqId) delete next.duplicateOf;
  const reopen = reopenedPages(project,changed ? [...physicalPages(current),...physicalPages(next)] : []);
  let rows = invalidateRows(project.rows,[reqId,...reopen.affected]);
  rows = Object.fromEntries(Object.entries(rows).filter(([id]) => id!==reqId));
  rows[next.id] = {...(project.rows[reqId] || emptyResponse(reqId)),requirementId:next.id,comparison:STATUS.pending,assessment:null,decisionSource:null};
  return {...project,requirements:project.requirements.map(req => req.id===reqId ? next : req),rows,
    evidence:project.evidence.map(mark => ({...mark,requirementIds:linkedRequirements(mark).map(id => id===reqId ? next.id : id)})),
    ...reopen.patch,
  };
}

export function appendRequirements(project, incoming, {ocrPage=null}={}) {
  if (!Array.isArray(incoming)) throw new Error('ข้อ TOR ที่เพิ่มไม่ถูกต้อง');
  if (ocrPage!==null) pageNumber(ocrPage);
  const validated = incoming.map(value => {
    record(value,'ข้อ TOR ที่เพิ่มไม่ถูกต้อง');
    const requirement = sourceProvenance({...value,id:requirementId(value.id),textSnapshot:text(value.textSnapshot,'ข้อความ TOR',true,100000),reviewed:false});
    if (has(requirement,'title')) requirement.title = text(requirement.title,'หัวข้อ',false,1000);
    if (ocrPage!==null && !physicalPages(requirement).includes(ocrPage)) throw new Error('ข้อ TOR ไม่ตรงกับหน้า OCR ที่อ่าน');
    return requirement;
  });
  const additions = uniqueRequirements(validated,project.requirements);
  const reopen = reopenedPages(project,additions.flatMap(physicalPages));
  const rows = {...invalidateRows(project.rows,reopen.affected),...Object.fromEntries(additions.map(req => [req.id,emptyResponse(req.id)]))};
  return {...project,requirements:[...project.requirements,...additions],rows,
    ocrPages:ocrPage!==null ? [...new Set([...(project.ocrPages || []),ocrPage])] : project.ocrPages || [],
    ...reopen.patch,
  };
}

export function removeRequirement(project, reqId) {
  const current = find(project.requirements,reqId,'ข้อ TOR');
  const reopen = reopenedPages(project,physicalPages(current));
  const rows = Object.fromEntries(Object.entries(invalidateRows(project.rows,reopen.affected)).filter(([id]) => id!==reqId));
  const evidence = project.evidence.flatMap(mark => {
    if (!linkedRequirements(mark).includes(reqId)) return [mark];
    const requirementIds = linkedRequirements(mark).filter(id => id!==reqId);
    return requirementIds.length ? [{...mark,requirementIds}] : [];
  });
  return {...project,requirements:project.requirements.filter(req => req.id!==reqId),rows,evidence,...reopen.patch};
}

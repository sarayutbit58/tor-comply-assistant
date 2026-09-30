import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateProject, STATUS, projectFileIds} from '../src/lib/projectModel.mjs';
import {remapProject} from '../src/lib/archiveModel.mjs';

const mutations = await import('../src/lib/projectMutations.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const action = name => {
  assert.equal(typeof mutations[name], 'function', `${name} must be exported`);
  return mutations[name];
};
function fixture() {
  return migrateProject({
    id:'p', torDocId:'source', template:{id:'source'}, schemaVersion:4,sourceReviewPolicy:2,
    requirements:[
      {id:'5.1',textSnapshot:'Support IPv6',sourcePage:1,reviewed:true,sourceTableIndex:0,sourceRow:2},
      {id:'5.2',textSnapshot:'At least 24 ports',sourcePage:1,reviewed:true},
      {id:'5.3',textSnapshot:'Warranty 3 years',sourcePage:2,reviewed:true},
    ],
    products:[{id:'a',kind:'product',name:'Switch',brand:'QA',model:'A'}, {id:'b',kind:'service',name:'Warranty',provider:'QA provider'}],
    docs:[{id:'d',role:'product',itemIds:['a'],name:'switch.pdf',pageCount:2}, {id:'w',role:'service',itemIds:['b'],name:'warranty.pdf',pageCount:1}],
    evidence:[{id:'e',docId:'d',pdfPage:1,box:[.1,.2,.3,.05],quote:'Support IPv6; 48 ports',printedPage:'A-1',requirementIds:['5.1','5.2'],sourceMethod:'text',reviewed:true}],
    rows:Object.fromEntries(['5.1','5.2','5.3'].map((id,i) => [id,{requirementId:id,itemIds:[i===2?'b':'a'],proposal:'QA offer',comparison:STATUS.pass,assessment:{status:'pass'},decisionSource:'auto'}])),
    unreadablePages:[1], ocrPages:[],
  });
}
function pending(project, ids) {
  for (const id of ids) {
    assert.equal(project.rows[id].comparison,STATUS.pending,id);
    assert.equal(project.rows[id].assessment,null,id);
    assert.equal(project.rows[id].decisionSource,null,id);
  }
}

test('editing an offering invalidates every dependent clause without changing originals or unrelated answers', () => {
  const update=action('updateOffering'), p=fixture(), before=structuredClone(p);
  const next=update(p,'a',{model:'A2'});
  assert.equal(next.products[0].model,'A2'); pending(next,['5.1','5.2']);
  assert.equal(next.rows['5.3'].comparison,STATUS.pass);
  assert.deepEqual(next.evidence,p.evidence); assert.deepEqual(projectFileIds(next),projectFileIds(p));
  assert.deepEqual(p,before);
});
test('offering edits reject missing IDs, blank identity and incompatible kind changes', () => {
  const update=action('updateOffering'), p=fixture();
  assert.throws(()=>update(p,'missing',{name:'new'}),/ไม่พบ/);
  assert.throws(()=>update(p,'a',{brand:' '}),/ยี่ห้อ/);
  assert.throws(()=>update(p,'a',{name:''}),/ชื่อ/);
  assert.throws(()=>update(p,'a',{kind:'service'}),/ประเภท|เอกสาร/);
  assert.throws(()=>update(p,'a',{id:'other'}),/แก้ไข|ข้อมูล/);
  for (const kind of ['',null,false,'unknown']) assert.throws(()=>update(p,'a',{kind}),/ประเภท/);
});
test('removing an offering preserves document originals and shared regions while invalidating dependent responses', () => {
  const remove=action('removeOffering'), p=fixture(), next=remove(p,'a');
  assert.equal(next.products.some(item=>item.id==='a'),false);
  assert.deepEqual(next.docs[0].itemIds,[]); assert.deepEqual(next.rows['5.1'].itemIds,[]);
  assert.deepEqual(next.evidence,p.evidence); assert.deepEqual(projectFileIds(next),projectFileIds(p));
  pending(next,['5.1','5.2']); assert.equal(next.rows['5.3'].comparison,STATUS.pass);
  assert.throws(()=>remove(p,'missing'),/ไม่พบ/);
});
test('document rename preserves the blob identity and invalidates all clauses citing its shared region', () => {
  const update=action('updateDocumentMetadata'), p=fixture(), next=update(p,'d',{name:'correct-name.pdf'});
  assert.equal(next.docs[0].name,'correct-name.pdf'); assert.equal(next.docs[0].id,'d');
  assert.deepEqual(next.evidence,p.evidence); pending(next,['5.1','5.2']);
  assert.equal(next.rows['5.3'].comparison,STATUS.pass);
});
test('reassigning a document invalidates old and new selected offerings and preserves evidence regions', () => {
  const update=action('updateDocumentMetadata'), p=fixture();
  const next=update(p,'d',{role:'service',itemIds:['b']});
  assert.equal(next.docs[0].role,'service'); assert.deepEqual(next.docs[0].itemIds,['b']);
  pending(next,['5.1','5.2','5.3']); assert.deepEqual(next.evidence,p.evidence);
});
test('document metadata rejects source roles, unknown offering IDs, wrong offering kinds and empty associations', () => {
  const update=action('updateDocumentMetadata'), p=fixture();
  assert.throws(()=>update(p,'missing',{name:'new'}),/ไม่พบ/);
  for (const role of ['tor','template','other']) assert.throws(()=>update(p,'d',{role}),/ประเภท/);
  assert.throws(()=>update(p,'d',{itemIds:['missing']}),/ไม่พบ/);
  assert.throws(()=>update(p,'d',{itemIds:['b']}),/ประเภท/);
  assert.throws(()=>update(p,'d',{itemIds:[]}),/เลือก|รายการ/);
  assert.throws(()=>update(p,'d',{name:''}),/ชื่อ/);
  assert.throws(()=>update(p,'d',{pageCount:0}),/แก้ไข|ข้อมูล/);
});
test('bidder reclassification accepts no product associations and invalidates bidder-scoped rows too', () => {
  const update=action('updateDocumentMetadata'), p=fixture(); p.rows['5.3'].scope='bidder'; p.rows['5.3'].itemIds=[];
  const next=update(p,'d',{role:'bidder',itemIds:[]});
  assert.deepEqual(next.docs[0].itemIds,[]); pending(next,['5.1','5.2','5.3']);
  assert.throws(()=>update(p,'d',{role:'bidder',itemIds:['a']}),/รายการ|คุณสมบัติ/);
});
test('a corrected shared quote clears review and invalidates every linked clause', () => {
  const update=action('updateEvidenceMark'), p=fixture(), next=update(p,'e',{quote:'Support IPv6; at least 48 ports',reviewed:true});
  assert.equal(next.evidence[0].quote,'Support IPv6; at least 48 ports');
  assert.equal(next.evidence[0].reviewed,false); assert.equal(next.evidence[0].sourceMethod,'corrected');
  assert.equal(next.evidence[0].rawQuote,p.evidence[0].quote);
  pending(next,['5.1','5.2']); assert.equal(p.evidence[0].reviewed,true);
});
test('changing an evidence region clears review while changing only its printed label retains source review', () => {
  const update=action('updateEvidenceMark'), p=fixture();
  const moved=update(p,'e',{box:[.1,.3,.3,.05]});
  assert.equal(moved.evidence[0].reviewed,false); assert.equal(moved.evidence[0].sourceMethod,'corrected');
  const labelled=update(p,'e',{printedPage:'Appendix B'});
  assert.equal(labelled.evidence[0].reviewed,true); assert.equal(labelled.evidence[0].printedPage,'Appendix B');
  pending(labelled,['5.1','5.2']);
});
test('shared evidence links are validated and both previous and new clauses are invalidated', () => {
  const update=action('updateEvidenceMark'), p=fixture(), next=update(p,'e',{requirementIds:['5.2','5.3','5.3']});
  assert.deepEqual(next.evidence[0].requirementIds,['5.2','5.3']); pending(next,['5.1','5.2','5.3']);
  assert.throws(()=>update(p,'e',{requirementIds:[]}),/TOR|ผูก/);
  assert.throws(()=>update(p,'e',{requirementIds:['missing']}),/TOR|ไม่พบ/);
});
test('evidence edits reject missing IDs, empty quotes, invalid page and invalid box', () => {
  const update=action('updateEvidenceMark'), p=fixture();
  assert.throws(()=>update(p,'missing',{quote:'x'}),/ไม่พบ/);
  assert.throws(()=>update(p,'e',{quote:' '}),/ข้อความ/);
  for (const pdfPage of [0,3,1.5,NaN]) assert.throws(()=>update(p,'e',{pdfPage}),/หน้า/);
  for (const box of [[0,0,0,.1],[-.1,0,.1,.1],[.9,.9,.2,.2],[0,0,.2],[0,0,.1,.1,.1]]) assert.throws(()=>update(p,'e',{box}),/กรอบ/);
  assert.throws(()=>update(p,'e',{docId:'source'}),/แก้ไข|ข้อมูล/);
});
test('evidence review confirmation may be applied only after the quote/region correction has already been saved', () => {
  const update=action('updateEvidenceMark'), p=fixture();
  const corrected=update(p,'e',{quote:'Support IPv6; 48 ports; MPLS'});
  const next=update(corrected,'e',{reviewed:true}); assert.equal(next.evidence[0].reviewed,true);
  pending(next,['5.1','5.2']);
});
test('a specific unreadable page resolves only with explicit confirmation and reviewed transcribed clauses', () => {
  const resolve=action('resolveSourcePage'), p=fixture();
  const next=resolve(p,1,{confirmed:true,reason:'Compared all clauses against the source image',kind:'transcribed',requirementIds:['5.1','5.2']});
  assert.deepEqual(next.unreadablePages,[]); assert.equal(next.sourcePageResolutions[0].page,1);
  assert.equal(next.sourcePageResolutions[0].kind,'transcribed');
  assert.deepEqual(next.sourcePageResolutions[0].requirementIds,['5.1','5.2']);
  assert.deepEqual(p.unreadablePages,[1]); assert.deepEqual(next.ocrPages,[]);
  pending(next,['5.1','5.2']);
});
test('source-page resolution stores no additional stale file ID after archive import remaps the original', () => {
  const resolve=action('resolveSourcePage'), p=fixture();
  const next=resolve(p,1,{confirmed:true,reason:'Compared source',kind:'transcribed',requirementIds:['5.1','5.2']});
  let serial=0;const imported=remapProject(next,()=>`new-${++serial}`).project;
  assert.notEqual(imported.torDocId,p.torDocId);
  assert.ok(!JSON.stringify(imported.sourcePageResolutions).includes('"source"'));
});
test('source-page resolution rejects unconfirmed, wrong-page, incomplete and unreviewed clause coverage', () => {
  const resolve=action('resolveSourcePage'), p=fixture();
  const options={confirmed:true,reason:'Compared source',kind:'transcribed',requirementIds:['5.1','5.2']};
  assert.throws(()=>resolve(p,1,{...options,confirmed:false}),/ยืนยัน/);
  assert.throws(()=>resolve(p,1,{...options,reason:' '}),/เหตุผล/);
  assert.throws(()=>resolve(p,2,options),/หน้า/);
  assert.throws(()=>resolve(p,1,{...options,requirementIds:['5.1']}),/ครบ|ข้อ/);
  assert.throws(()=>resolve(p,1,{...options,requirementIds:['5.1','5.3']}),/หน้า|ข้อ/);
  p.requirements[1].reviewed=false;
  assert.throws(()=>resolve(p,1,options),/ตรวจ/);
});
test('a genuinely blank/non-requirement source page can resolve with an explicit recorded reason', () => {
  const resolve=action('resolveSourcePage'), p=fixture();p.unreadablePages=[3];
  const next=resolve(p,3,{confirmed:true,reason:'Cover page, no TOR clauses',kind:'no-requirements'});
  assert.deepEqual(next.unreadablePages,[]); assert.deepEqual(next.sourcePageResolutions[0].requirementIds,[]);
  assert.throws(()=>resolve(fixture(),1,{confirmed:true,reason:'skip',kind:'no-requirements'}),/ข้อ/);
});
test('an unsaved OCR/manual page draft cannot be certified as an empty or complete page',()=>{
 const p=fixture();p.unreadablePages=[3];
 assert.throws(()=>action('resolveSourcePage')(p,3,{confirmed:true,reason:'cover',kind:'no-requirements',draft:'5.4 Support MPLS'}),/ข้อความ/);
});
test('renumbering preserves proposal, selected offerings, source metadata and shared evidence links while clearing the verdict', () => {
  const replace=action('replaceRequirement'), p=fixture(), next=replace(p,'5.1',{id:'5.10',textSnapshot:'Support IPv6',sourcePage:1,reviewed:true});
  assert.equal(next.rows['5.1'],undefined); assert.equal(next.rows['5.10'].requirementId,'5.10');
  assert.equal(next.rows['5.10'].proposal,'QA offer'); assert.deepEqual(next.rows['5.10'].itemIds,['a']);
  assert.deepEqual(next.evidence[0].requirementIds,['5.10','5.2']);
  assert.equal(next.requirements[0].sourceTableIndex,0); assert.equal(next.requirements[0].sourceRow,2);
  assert.equal(next.requirements[0].reviewed,false); pending(next,['5.10']);
});
test('changing clause text records correction provenance and clears review even if the patch asks to keep it', () => {
  const replace=action('replaceRequirement'), p=fixture();
  const next=replace(p,'5.1',{textSnapshot:'Support IPv6 and MPLS',reviewed:true,sourceCorrection:{method:'manual',page:1,box:[.1,.2,.3,.05],reason:'Missing line copied from source'}});
  const req=next.requirements[0]; assert.equal(req.rawTextSnapshot,'Support IPv6');
  assert.equal(req.textSnapshot,'Support IPv6 and MPLS'); assert.equal(req.reviewed,false);
  assert.equal(req.sourceCorrections[0].previousText,'Support IPv6');
  assert.equal(req.sourceCorrections[0].nextText,'Support IPv6 and MPLS');
  assert.equal(req.sourceCorrections[0].method,'manual'); assert.deepEqual(req.sourceCorrections[0].box,[.1,.2,.3,.05]);
  assert.equal(req.sourceMethod,'corrected'); pending(next,['5.1']);
});
test('successive source corrections keep the first raw reading and append history without mutating previous versions', () => {
  const replace=action('replaceRequirement'), p=fixture();
  const first=replace(p,'5.1',{textSnapshot:'Support IPv6 and MPLS',sourceCorrection:{method:'manual',page:1}});
  const next=replace(first,'5.1',{textSnapshot:'Must support IPv6 and MPLS',sourceCorrection:{method:'geometry',page:1}});
  assert.equal(next.requirements[0].rawTextSnapshot,'Support IPv6');
  assert.equal(next.requirements[0].sourceCorrections.length,2); assert.equal(first.requirements[0].sourceCorrections.length,1);
});
test('review-only clause saves are allowed and invalidate any old assessment', () => {
  const replace=action('replaceRequirement'), p=fixture();p.requirements[0].reviewed=false;
  const next=replace(p,'5.1',{reviewed:true}); assert.equal(next.requirements[0].reviewed,true);pending(next,['5.1']);
});
test('clause replacement rejects missing/duplicate/unsafe IDs, blank text and invalid source pages', () => {
  const replace=action('replaceRequirement'), p=fixture();
  assert.throws(()=>replace(p,'missing',{textSnapshot:'x'}),/ไม่พบ/);
  assert.throws(()=>replace(p,'5.1',{id:'5.2'}),/ซ้ำ/);
  for (const id of ['','__proto__','constructor','prototype','5\u00001']) assert.throws(()=>replace(p,'5.1',{id}),/เลขข้อ/);
  assert.throws(()=>replace(p,'5.1',{textSnapshot:' '}),/ข้อความ/);
  for (const sourcePage of [0,-1,1.5,NaN]) assert.throws(()=>replace(p,'5.1',{sourcePage}),/หน้า/);
  assert.throws(()=>replace(p,'5.1',{sourceCorrection:{method:'manual',box:[0,0,-.1,.1]}}),/กรอบ/);
  assert.throws(()=>replace(p,'5.1',{sourceMethod:7}),/วิธี|ประเภท/);
  assert.throws(()=>replace(p,'5.1',{sourceCorrection:{method:''}}),/วิธี/);
});
test('changing only a clause source method also requires source review again', () => {
  const replace=action('replaceRequirement'), next=replace(fixture(),'5.1',{sourceMethod:'manual',reviewed:true});
  assert.equal(next.requirements[0].reviewed,false); assert.equal(next.requirements[0].sourceMethod,'corrected');
});
test('editing a resolved source page reopens its unreadable gate instead of retaining a stale full-page confirmation', () => {
  const replace=action('replaceRequirement'), resolve=action('resolveSourcePage'), p=fixture();
  const resolved=resolve(p,1,{confirmed:true,reason:'Compared source',kind:'transcribed',requirementIds:['5.1','5.2']});
  const next=replace(resolved,'5.1',{textSnapshot:'Support IPv6 and MPLS'});
  assert.deepEqual(next.unreadablePages,[1]);assert.deepEqual(next.sourcePageResolutions,[]);
});
test('a continuation page resolves using reviewed clauses whose first physical page is earlier', () => {
  const resolve=action('resolveSourcePage'), p=fixture();
  p.unreadablePages=[2];p.requirements[0].sourcePages=[1,2];
  const options={confirmed:true,reason:'Compared full continuation page',kind:'transcribed',requirementIds:['5.1','5.3']};
  const next=resolve(p,2,options);
  assert.deepEqual(next.unreadablePages,[]);assert.deepEqual(next.sourcePageResolutions[0].requirementIds,['5.1','5.3']);
  assert.throws(()=>resolve(p,2,{...options,requirementIds:['5.3']}),/ครบ/);
  assert.throws(()=>resolve(p,2,{confirmed:true,reason:'No new heading',kind:'no-requirements'}),/ข้อ/);
});
test('correcting a multi-page clause reopens every prior/new page resolution and preserves regional provenance', () => {
  const replace=action('replaceRequirement'), p=fixture();
  p.unreadablePages=[];p.requirements[0].sourcePages=[1,2];
  p.requirements[0].sourceRegions=[{page:1,box:[.1,.2,.3,.1]},{page:2,box:[.1,.1,.3,.1]}];
  p.sourcePageResolutions=[1,2,3].map(page=>({page,kind:'transcribed',reason:'checked',requirementIds:['5.1']}));
  const next=replace(p,'5.1',{textSnapshot:'Support IPv6 and MPLS',sourcePages:[1,3],sourceRegions:[{page:1,box:[.1,.2,.3,.1]},{page:3,box:[.1,.1,.3,.1]}]});
  assert.deepEqual(next.unreadablePages,[1,2,3]);assert.deepEqual(next.sourcePageResolutions,[]);
  assert.deepEqual(next.requirements[0].sourcePages,[1,3]);assert.equal(next.requirements[0].sourceRegions[1].page,3);
  assert.equal(next.requirements[0].reviewed,false);
  assert.deepEqual(p.requirements[0].sourcePages,[1,2]);
});
test('source-page and source-region updates reject invalid physical pages or boxes', () => {
  const replace=action('replaceRequirement'), p=fixture();
  for (const sourcePages of [[0],[1.5],['1'],'1']) assert.throws(()=>replace(p,'5.1',{sourcePages}),/หน้า/);
  assert.throws(()=>replace(p,'5.1',{sourceRegions:[{page:1,box:[0,0,-.1,.1]}]}),/กรอบ/);
  assert.throws(()=>replace(p,'5.1',{sourceRegions:[{page:0,box:[0,0,.1,.1]}]}),/หน้า/);
});
test('appending duplicate clauses preserves both identities and always requires a fresh human review', () => {
  const append=action('appendRequirements'), p=fixture(), before=structuredClone(p);
  const next=append(p,[{id:'5.1',title:'new clause',textSnapshot:'Support MPLS',sourcePage:2,sourcePages:[2,3],sourceMethod:'ocr',reviewed:true}]);
  assert.equal(next.requirements.length,4);
  assert.equal(next.requirements[3].id,'5.1#2');assert.equal(next.requirements[3].duplicateOf,'5.1');
  assert.equal(next.requirements[3].reviewed,false);
  assert.deepEqual(next.rows['5.1#2'],{requirementId:'5.1#2',itemIds:[],proposal:'',comparison:STATUS.pending,mode:null,assessment:null});
  assert.deepEqual(next.unreadablePages,[1]);assert.deepEqual(p,before);
});
test('recording OCR transcription does not resolve an unreadable source page or approve new clauses', () => {
  const append=action('appendRequirements'), p=fixture();
  const next=append(p,[{id:'6.1',textSnapshot:'Support MPLS',sourcePage:1,sourceMethod:'ocr',reviewed:true}],{ocrPage:1});
  assert.deepEqual(next.unreadablePages,[1]);assert.deepEqual(next.ocrPages,[1]);
  assert.equal(next.requirements[3].reviewed,false);
  assert.deepEqual(next.rows['5.1'],p.rows['5.1']);
});
test('page transcription preserves raw OCR and accepted text once per physical page',()=>{
 const p=fixture(),reading={page:1,rawText:'6.1 At least 42 ports',acceptedText:'6.1 At least 24 ports',method:'local-ocr'};
 const next=action('appendRequirements')(p,[{id:'6.1',textSnapshot:'At least 24 ports',sourcePage:1}],{ocrPage:1,pageReading:reading});
 assert.deepEqual(next.sourceReadings,[reading]);assert.equal(next.requirements.at(-1).reviewed,false);assert.deepEqual(next.unreadablePages,[1]);
 assert.throws(()=>action('appendRequirements')(p,[{id:'6.1',textSnapshot:'IPv6',sourcePage:1}],{pageReading:{...reading,page:99}}),/หน้า/);
});
test('adding a clause on previously resolved pages reopens each touched page and invalidates its existing clauses', () => {
  const append=action('appendRequirements'), p=fixture();
  p.unreadablePages=[];p.sourcePageResolutions=[1,2].map(page=>({page,kind:'transcribed',reason:'checked',requirementIds:page===1?['5.1','5.2']:['5.3']}));
  const next=append(p,[{id:'6.1',textSnapshot:'Support MPLS',sourcePage:1,sourcePages:[1,2]}]);
  assert.deepEqual(next.unreadablePages,[1,2]);assert.deepEqual(next.sourcePageResolutions,[]);
  pending(next,['5.1','5.2','5.3']);
});
test('appending clauses rejects missing/unsafe IDs, empty text, invalid pages and inconsistent OCR capture', () => {
  const append=action('appendRequirements'), p=fixture();
  assert.throws(()=>append(p,[{textSnapshot:'x'}]),/เลขข้อ/);
  assert.throws(()=>append(p,[{id:'__proto__',textSnapshot:'x'}]),/เลขข้อ/);
  assert.throws(()=>append(p,[{id:'6.1',textSnapshot:' '}]),/ข้อความ/);
  assert.throws(()=>append(p,[{id:'6.1',textSnapshot:'x',sourcePages:[0]}]),/หน้า/);
  assert.throws(()=>append(p,[{id:'6.1',textSnapshot:'x',sourcePage:2}],{ocrPage:1}),/หน้า/);
  assert.throws(()=>append(p,[{id:'6.1',textSnapshot:'x'}],{ocrPage:0}),/หน้า/);
});
test('removing a clause preserves the shared physical mark and its other clause links', () => {
  const remove=action('removeRequirement'), p=fixture(), before=structuredClone(p);
  const next=remove(p,'5.1');
  assert.equal(next.rows['5.1'],undefined);assert.equal(next.requirements.some(req=>req.id==='5.1'),false);
  assert.equal(next.evidence[0].id,'e');assert.deepEqual(next.evidence[0].requirementIds,['5.2']);
  assert.equal(next.rows['5.2'].comparison,STATUS.pass);assert.deepEqual(projectFileIds(next),projectFileIds(p));
  assert.deepEqual(p,before);
});
test('removing the last clause link removes the unused mark and rejects missing clauses', () => {
  const remove=action('removeRequirement'), p=fixture();p.evidence[0].requirementIds=['5.1'];
  const next=remove(p,'5.1');assert.deepEqual(next.evidence,[]);
  assert.throws(()=>remove(p,'missing'),/ไม่พบ/);
});
test('removing a multi-page clause reopens every resolved page and invalidates remaining clauses there', () => {
  const remove=action('removeRequirement'), p=fixture();
  p.requirements[0].sourcePages=[1,2];p.unreadablePages=[];
  p.sourcePageResolutions=[1,2].map(page=>({page,kind:'transcribed',reason:'checked',requirementIds:page===1?['5.1','5.2']:['5.1','5.3']}));
  const next=remove(p,'5.1');
  assert.deepEqual(next.unreadablePages,[1,2]);assert.deepEqual(next.sourcePageResolutions,[]);
  pending(next,['5.2','5.3']);assert.deepEqual(next.evidence[0].requirementIds,['5.2']);
});
test('removing a document removes its marks and invalidates all selected-offering clauses even without a citation', () => {
  const remove=action('removeDocumentMetadata'), p=fixture();
  p.evidence=[];const before=structuredClone(p), next=remove(p,'d');
  assert.deepEqual(next.docs.map(doc=>doc.id),['w']);assert.deepEqual(next.evidence,[]);
  pending(next,['5.1','5.2']);assert.equal(next.rows['5.3'].comparison,STATUS.pass);
  assert.deepEqual(next.products,p.products);assert.deepEqual(next.requirements,p.requirements);
  assert.equal(next.torDocId,'source');assert.equal(next.template.id,'source');
  assert.deepEqual(p,before);
  assert.throws(()=>remove(p,'missing'),/ไม่พบ/);
});
test('removing bidder evidence invalidates bidder-scoped rows and retains unrelated marks', () => {
  const remove=action('removeDocumentMetadata'), p=fixture();
  p.docs.push({id:'bid',role:'bidder',itemIds:[],name:'bidder.pdf',pageCount:1});
  p.rows['5.3'].scope='bidder';p.rows['5.3'].itemIds=[];
  p.evidence.push({id:'eb',docId:'bid',pdfPage:1,box:[0,0,.5,.1],quote:'Company qualification',requirementIds:['5.3'],sourceMethod:'text',reviewed:true});
  const next=remove(p,'bid');pending(next,['5.3']);
  assert.equal(next.evidence.length,1);assert.equal(next.evidence[0].id,'e');
  assert.equal(next.rows['5.1'].comparison,STATUS.pass);assert.equal(next.docs.length,2);
});

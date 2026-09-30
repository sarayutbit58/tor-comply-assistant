import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManifest,remapProject} from '../src/lib/archiveModel.mjs';
import {exportProblems,STATUS} from '../src/lib/projectModel.mjs';

const fixture=()=>({format:'tor-comply-project',version:1,project:{
 id:'p',name:'Synthetic source validation',schemaVersion:4,sourceReviewPolicy:2,torDocId:'t',sourcePageCount:2,
 requirements:[{id:'1',title:'IPv6',textSnapshot:'IPv6',rawTextSnapshot:'IPv6',sourcePage:1,sourcePages:[1],sourceRegions:[{page:1,box:[.1,.1,.3,.05]}],reviewed:true}],
 products:[{id:'a',kind:'product',name:'QA A'}],docs:[{id:'d',name:'qa.pdf',role:'product',itemIds:['a'],pageCount:1}],
 evidence:[{id:'e',docId:'d',pdfPage:1,box:[.1,.1,.3,.05],requirementIds:['1'],quote:'IPv6',keyword:'IPv6',printedPage:'A-1',sourceMethod:'manual',reviewed:true}],
 rows:{1:{requirementId:'1',itemIds:['a'],proposal:'IPv6',comparison:STATUS.pass}},
 unreadablePages:[],ocrPages:[],sourceWarnings:[],sourceUnresolvedRows:[],sourceCoveragePending:false,
 sourcePageResolutions:[{page:1,kind:'transcribed',reason:'Compared full page',requirementIds:['1']}],
},files:[{id:'t',path:'files/0.bin',metaPath:'metadata/0.json',size:1,sha256:'0'.repeat(64)},{id:'d',path:'files/1.bin',metaPath:'metadata/1.json',size:1,sha256:'1'.repeat(64)}]});

test('present quotation labels must be strings before an archive can reach evidence editors',()=>{
 for(const field of ['quote','keyword','printedPage','rawQuote','sourceMethod'])for(const value of [7,{},[],null,false]){
  const f=fixture();f.project.evidence[0][field]=value;
  assert.throws(()=>validateManifest(f),/ข้อความ|หลักฐาน/,field);
 }
});
test('source arrays and flags reject shapes that would crash the workbench',()=>{
 for(const field of ['sourceWarnings','sourceUnresolvedRows','sourcePageResolutions','unreadablePages','ocrPages'])for(const value of ['bad',{},null]){
  const f=fixture();f.project[field]=value;
  assert.throws(()=>validateManifest(f),/ต้นฉบับ|หน้า|ข้อความ/,field);
 }
 for(const field of ['sourcePages','sourceRegions','sourceCorrections','readingIssues']){
  const f=fixture();f.project.requirements[0][field]='bad';
  assert.throws(()=>validateManifest(f),/ต้นฉบับ|หน้า|ข้อความ/,field);
 }
 for(const value of ['false',0,{},null]){const f=fixture();f.project.sourceCoveragePending=value;assert.throws(()=>validateManifest(f),/ครบถ้วน|ต้นฉบับ/);}
});
test('every physical source page and region is bounded by the original page count',()=>{
 for(const value of [0,-1,1.5,'1',3,NaN]){
  const f=fixture();f.project.requirements[0].sourcePage=value;assert.throws(()=>validateManifest(f),/หน้า/);
  const pages=fixture();pages.project.requirements[0].sourcePages=[value];assert.throws(()=>validateManifest(pages),/หน้า/);
  const region=fixture();region.project.requirements[0].sourceRegions[0].page=value;assert.throws(()=>validateManifest(region),/หน้า/);
 }
 for(const value of [0,-1,1.5,'2',NaN]){const f=fixture();f.project.sourcePageCount=value;assert.throws(()=>validateManifest(f),/หน้า/);}
 const mismatched=fixture();mismatched.project.requirements[0].sourceRegions[0].page=2;
 assert.throws(()=>validateManifest(mismatched),/หน้า/);
});
test('region and mark boxes must have exactly four finite valid coordinates',()=>{
 for(const box of [[0,0,.2],[-.1,0,.2,.1],[.9,.9,.2,.2],[0,0,.2,0],[0,0,.2,.1,9],['0',0,.2,.1],null]){
  const f=fixture();f.project.requirements[0].sourceRegions[0].box=box;assert.throws(()=>validateManifest(f),/กรอบ/);
  const mark=fixture();mark.project.evidence[0].box=box;assert.throws(()=>validateManifest(mark),/กรอบ/);
 }
});
test('raw source text, review flags and corrections reject invalid present fields',()=>{
 for(const field of ['title','rawTextSnapshot','sourceMethod','duplicateOf']){
  const f=fixture();f.project.requirements[0][field]={bad:true};assert.throws(()=>validateManifest(f),/ข้อความ|ต้นฉบับ/);
 }
 const review=fixture();review.project.requirements[0].reviewed='true';assert.throws(()=>validateManifest(review),/ตรวจ|ต้นฉบับ/);
 const mark=fixture();mark.project.evidence[0].reviewed='true';assert.throws(()=>validateManifest(mark),/ตรวจ|หลักฐาน/);
 for(const correction of [null,{method:5},{previousText:7},{nextText:{}},{page:3},{box:[0,0,-1,.1]}]){
  const f=fixture();f.project.requirements[0].sourceCorrections=[correction];assert.throws(()=>validateManifest(f),/ข้อความ|ต้นฉบับ|หน้า|กรอบ/);
 }
});
test('source page resolutions must reference known clauses on their actual source page',()=>{
 for(const resolution of [null,{page:3,kind:'no-requirements',reason:'cover',requirementIds:[]},{page:1,kind:'transcribed',reason:'checked',requirementIds:['missing']},{page:2,kind:'transcribed',reason:'checked',requirementIds:['1']},{page:1,kind:'no-requirements',reason:'skip',requirementIds:[]},{page:1,kind:'transcribed',reason:'checked',requirementIds:'1'}]){
  const f=fixture();f.project.sourcePageResolutions=[resolution];assert.throws(()=>validateManifest(f),/หน้า|ข้อ|ต้นฉบับ/);
 }
 const pending=fixture();pending.project.unreadablePages=[1];assert.throws(()=>validateManifest(pending),/หน้า/);
});
test('coverage metadata cannot assert completed warnings without a recorded confirmation',()=>{
 const f=fixture();f.project.sourceWarnings=['Other sheet omitted'];assert.throws(()=>validateManifest(f),/ครบถ้วน/);
 for(const resolution of ['bad',{}, {reason:7},{reason:' '},{reason:'checked',confirmedAt:'invalid date'}]){
  const f=fixture();f.project.sourceCoverageResolution=resolution;assert.throws(()=>validateManifest(f),/ครบถ้วน/);
 }
 for(const value of ['2',false,0,3]){const f=fixture();f.project.sourceReviewPolicy=value;assert.throws(()=>validateManifest(f),/นโยบาย|ตรวจ/);}
});
test('valid completed coverage and correction provenance survive ID remapping',()=>{
 const f=fixture();f.project.sourceWarnings=['Reviewed other sheet'];
 f.project.sourceCoverageResolution={reason:'Checked every omitted sheet',confirmedAt:'2026-09-30T12:00:00.000Z'};
 f.project.requirements[0].sourceCorrections=[{method:'manual',page:1,box:[.1,.1,.3,.05],previousId:'old-number',nextId:'1',previousText:'IPv 6',nextText:'IPv6'}];
 f.project.requirements[0].readingIssues=[{code:'critical-values',severity:'review',label:'Values',reason:'Compare source'}];
 const p=validateManifest(f);let serial=0;const restored=remapProject(p,()=>`new-${++serial}`).project;
 assert.deepEqual(restored.requirements[0].sourceRegions,p.requirements[0].sourceRegions);
 assert.deepEqual(restored.requirements[0].sourceCorrections,p.requirements[0].sourceCorrections);
 assert.deepEqual(restored.sourceCoverageResolution,p.sourceCoverageResolution);
 assert.equal(exportProblems(restored).length,0);
});
test('missing legacy optional fields remain importable and absent coverage flags default conservatively',()=>{
 const f=fixture();for(const field of ['sourcePageCount','sourceReviewPolicy','sourceWarnings','sourceUnresolvedRows','sourceCoveragePending','sourcePageResolutions','ocrPages'])delete f.project[field];
 for(const field of ['title','rawTextSnapshot','sourcePage','sourcePages','sourceRegions','reviewed'])delete f.project.requirements[0][field];
 for(const field of ['quote','keyword','printedPage','sourceMethod','reviewed'])delete f.project.evidence[0][field];
 assert.doesNotThrow(()=>validateManifest(f));
 const warning=fixture();warning.project.sourceWarnings=['Legacy unconfirmed warning'];delete warning.project.sourceCoveragePending;
 assert.equal(validateManifest(warning).sourceCoveragePending,true);
});
test('unresolved rows and reading issue objects are validated before rendering source review',()=>{
 for(const row of [null,{tableId:'xlsx:0',row:'2',number:'1',reason:'missing'},{tableId:'xlsx:0',row:2,number:7,reason:'missing'},{tableId:'xlsx:0',row:2,number:'1',reason:{}}]){
  const f=fixture();f.project.sourceUnresolvedRows=[row];f.project.sourceCoveragePending=true;assert.throws(()=>validateManifest(f),/ต้นฉบับ|ข้อความ|แถว/);
 }
 const warning=fixture();warning.project.sourceWarnings=[{message:'bad'}];assert.throws(()=>validateManifest(warning),/ข้อความ|ต้นฉบับ/);
 const issue=fixture();issue.project.requirements[0].readingIssues=[{code:'issue',label:{},reason:'bad'}];assert.throws(()=>validateManifest(issue),/ข้อความ|ต้นฉบับ/);
});
test('page readings preserve original/accepted text and reject invalid, oversized or duplicate records',()=>{
 const f=fixture();f.project.sourceReadings=[{page:1,rawText:'IPv 6',acceptedText:'IPv6',method:'local-ocr'}];
 const p=validateManifest(f);let serial=0;const restored=remapProject(p,()=>`reading-${++serial}`).project;
 assert.deepEqual(restored.sourceReadings,f.project.sourceReadings);
 for(const records of ['bad',[null],[{page:3,rawText:'x',acceptedText:'x',method:'manual'}],[{page:1,rawText:7,acceptedText:'x',method:'manual'}],[{page:1,rawText:'x',acceptedText:{},method:'manual'}],[{page:1,rawText:'x',acceptedText:'x',method:'unknown'}],[{page:1,rawText:'x'.repeat(100001),acceptedText:'x',method:'ocr'}],[...f.project.sourceReadings,...f.project.sourceReadings]]){
  const bad=fixture();bad.project.sourceReadings=records;assert.throws(()=>validateManifest(bad),/ข้อความ|ต้นฉบับ|หน้า/);
 }
 const legacy=fixture();assert.doesNotThrow(()=>validateManifest(legacy));
});

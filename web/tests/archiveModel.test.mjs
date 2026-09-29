import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManifest,remapProject} from '../src/lib/archiveModel.mjs';
const fixture=()=>({format:'tor-comply-project',version:1,project:{id:'original',name:'QA',requirements:[{id:'5.1',textSnapshot:'IPv6',reviewed:true}],products:[{id:'a'}],docs:[{id:'d',role:'product',itemIds:['a'],pageCount:1}],evidence:[{id:'e',docId:'d',pdfPage:1,box:[0,0,.5,.1],requirementIds:['5.1']}],rows:{'5.1':{itemIds:['a'],proposal:'A',comparison:'รอตรวจสอบ'}},torDocId:'t'},files:[{id:'d',path:'files/0.bin',metaPath:'metadata/0.json',size:1,sha256:'0'.repeat(64)},{id:'t',path:'files/1.bin',metaPath:'metadata/1.json',size:1,sha256:'1'.repeat(64)}]});
test('project import remaps source IDs and shared evidence without overwriting existing project',()=>{
  const p=validateManifest(fixture());let index=0;
  const clone=remapProject(p,()=>String(++index));
  assert.notEqual(clone.project.id,p.id);
  assert.equal(clone.project.evidence[0].docId,clone.project.docs[0].id);
  assert.notEqual(clone.project.torDocId,p.torDocId);
});
test('missing attachments, illegal roles and broken references are rejected before import',()=>{
  const missing=fixture();missing.files.pop();assert.throws(()=>validateManifest(missing),/ไม่ครบ/);
  const role=fixture();role.project.docs[0].role='tor';assert.throws(()=>validateManifest(role),/หลักฐาน/);
  const ref=fixture();ref.project.evidence[0].requirementIds=['absent'];assert.throws(()=>validateManifest(ref),/TOR/);
});
test('maximum names and Thai clause labels survive repeated transfers',()=>{
  const f=fixture();f.project.name='x'.repeat(160);f.project.requirements[0].id='1(ก)';f.project.evidence[0].requirementIds=['1(ก)'];
  const p=validateManifest(f);let i=0;const clone=remapProject(p,()=>String(++i));
  assert.equal(clone.project.name.length,160);
});

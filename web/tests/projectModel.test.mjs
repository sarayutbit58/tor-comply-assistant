import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateProject, mergeMark, exportProblems, passProblems, evidenceFor } from '../src/lib/projectModel.mjs';
const fixture = () => migrateProject({id:'p',name:'test',requirements:[{id:'5.1',textSnapshot:'IPv6'},{id:'5.2',textSnapshot:'MPLS'}],products:[{id:'a',name:'A'},{id:'b',name:'B'}],docs:[{id:'d',role:'product',itemIds:['a'],pageCount:1}],evidence:[],rows:{}});
test('TOR and templates cannot become evidence even when their text matches',()=>{
  const p=fixture(); p.docs[0].role='template';
  assert.throws(()=>mergeMark(p,{id:'e',docId:'d',pdfPage:1,box:[0,0,.5,.1],requirementIds:['5.1']}),/หลักฐาน/);
});
test('one mark shared by two clauses stays one mark and survives a single unlink',()=>{
  const p=fixture(), m={id:'e',docId:'d',pdfPage:1,box:[0,0,.5,.1],requirementIds:['5.1']};
  p.evidence=mergeMark(p,m); p.evidence=mergeMark(p,{...m,id:'e2',requirementIds:['5.2']});
  assert.equal(p.evidence.length,1); assert.equal(evidenceFor(p,'5.2').length,1);
});
test('multi-item pass needs all selected items and OCR must be reviewed',()=>{
  const p=fixture();p.requirements.forEach(r=>r.reviewed=true);
  p.rows['5.1']={itemIds:['a','b'],proposal:'A+B',comparison:'ตรงตามข้อกำหนด'};
  p.evidence=[{id:'e',docId:'d',pdfPage:1,box:[0,0,.5,.1],requirementIds:['5.1'],sourceMethod:'ocr',reviewed:false}];
  assert.ok(passProblems(p,'5.1').some(s=>s.includes('ทุกรายการ')));
  assert.ok(exportProblems(p).some(s=>s.includes('OCR')));
});
test('legacy projects retain single-product choices and citations without granting OCR approval',()=>{
  const p=migrateProject({name:'old',requirements:[{id:'1',textSnapshot:'old'}],products:[],docs:[],rows:{'1':{productId:'a'}},evidence:[{id:'e',requirementId:'1'}]});
  assert.deepEqual(p.rows['1'].itemIds,['a']);assert.deepEqual(p.evidence[0].requirementIds,['1']);assert.equal(p.requirements[0].reviewed,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {passProblems,exportProblems} from '../src/lib/projectModel.mjs';
const project={
 mode:'manual',requirements:[{id:'5.1',textSnapshot:'IPv6',reviewed:true}],unreadablePages:[],
 products:[{id:'p'}],docs:[{id:'d',role:'product',itemIds:['p'],pageCount:1}],
 rows:{'5.1':{itemIds:['p'],proposal:'IPv6',comparison:'ตรงตามข้อกำหนด'}},
 evidence:[{id:'e',docId:'d',requirementIds:['5.1'],pdfPage:1,box:[.1,.1,.2,.1],quote:'IPv6',sourceMethod:'manual',reviewed:false}],
};
test('all unreviewed source quotations, including manual and corrected text, block pass and exports',()=>{
 for(const method of ['manual','corrected','ocr','text']) {
  const p=structuredClone(project);p.evidence[0].sourceMethod=method;
  assert.ok(passProblems(p,'5.1').some(s=>/ตรวจ/.test(s)),method);
  assert.ok(exportProblems(p).some(s=>/ตรวจ/.test(s)),method);
  p.evidence[0].reviewed=true;
  assert.equal(passProblems(p,'5.1').length,0);
  assert.equal(exportProblems(p).length,0);
 }
});
test('each cited mark must belong to the current selected offering or bidder scope',()=>{
 const p=structuredClone(project);p.evidence[0].reviewed=true;p.docs.push({id:'other',role:'product',itemIds:['unselected'],pageCount:1});p.evidence.push({...p.evidence[0],id:'outside',docId:'other'});
 assert.ok(passProblems(p,'5.1').some(e=>/รายการที่เลือก/.test(e)));assert.ok(exportProblems(p).length);
 p.rows['5.1'].scope='bidder';p.rows['5.1'].itemIds=[];p.docs.push({id:'bidder',role:'bidder',itemIds:[],pageCount:1});p.evidence.push({...p.evidence[0],id:'bidder',docId:'bidder'});
 assert.ok(passProblems(p,'5.1').some(e=>/ขอบเขต/.test(e)));
});

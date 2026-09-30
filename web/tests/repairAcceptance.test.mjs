import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptReadingRepair,replaceRequirement} from '../src/lib/projectMutations.mjs';
const project=()=>({requirements:[{id:'1',textSnapshot:'24 ports',sourcePage:1,sourcePages:[1],sourceRegions:[{page:1,box:[.1,.1,.3,.05]}],reviewed:true}],rows:{1:{proposal:'old',comparison:'ตรงตามข้อกำหนด'}},evidence:[],unreadablePages:[]});
test('accepted source repair changes canonical page/region and retains before/after provenance',()=>{
 const p=project(),box=[.2,.2,.4,.05];const next=acceptReadingRepair(p,'1',{textSnapshot:'48 ports',page:2,box,method:'local-ocr'},{confirmed:true,expectedText:'24 ports'});
 const r=next.requirements[0];assert.equal(r.sourcePage,2);assert.deepEqual(r.sourcePages,[2]);assert.deepEqual(r.sourceRegions,[{page:2,box}]);assert.equal(r.reviewed,true);assert.equal(r.rawTextSnapshot,'24 ports');assert.equal(r.sourceCorrections[0].page,2);assert.equal(next.rows[1].comparison,'รอตรวจสอบ');assert.equal(p.requirements[0].sourcePage,1);
});
test('rejected or stale reading repair cannot replace a clause',()=>{
 const p=project();assert.throws(()=>acceptReadingRepair(p,'1',{textSnapshot:'48 ports',page:2},{confirmed:false,expectedText:'24 ports'}),/ยืนยัน/);
 assert.throws(()=>acceptReadingRepair(p,'1',{textSnapshot:'48 ports',page:2},{confirmed:true,expectedText:'stale'}),/เปลี่ยน/);
});
test('source repairs cannot claim a physical page outside the original',()=>{
 const p={...project(),sourcePageCount:2};assert.throws(()=>acceptReadingRepair(p,'1',{textSnapshot:'48 ports',page:99},{confirmed:true,expectedText:'24 ports'}),/หน้า/);
});
test('ordinary source page edits discard stale regions and old page coverage',()=>{
 const p={...project(),sourcePageCount:2},r=replaceRequirement(p,'1',{sourcePage:2}).requirements[0];assert.deepEqual(r.sourcePages,[2]);assert.deepEqual(r.sourceRegions,[]);assert.equal(r.reviewed,false);
});

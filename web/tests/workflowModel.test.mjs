import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowSummary,planBatch,recoverMetadata} from '../src/lib/workflowModel.mjs';
import {STATUS} from '../src/lib/projectModel.mjs';
const project=()=>({id:'p',mode:'manual',updatedAt:'a',unreadablePages:[],requirements:[{id:'1',reviewed:true},{id:'2',reviewed:false}],products:[{id:'x'}],docs:[{id:'d',role:'product',itemIds:['x']}],evidence:[],rows:{1:{itemIds:['x'],proposal:'',comparison:STATUS.pending},2:{itemIds:['x'],proposal:'',comparison:STATUS.pending}}});
test('keyless batch processes reviewed manual clauses and explains skipped clauses',()=>{
 const p=project(),plan=planBatch(p);assert.deepEqual(plan.ready,['1']);assert.equal(plan.skipped[0].id,'2');assert.match(plan.skipped[0].reason,/TOR/);
 assert.equal(workflowSummary(p).readyToSubmit,false);assert.equal(workflowSummary(p).next.action,'review');
});
test('Auto still requires whole TOR review while manual override can search locally',()=>{
 const p=project();p.mode='auto';assert.equal(planBatch(p).ready.length,0);p.rows[1].mode='manual';assert.deepEqual(planBatch(p).ready,['1']);
 p.requirements[1].reviewed=true;p.unreadablePages=[3];assert.equal(workflowSummary(p).next.action,'pages');
});
test('missing offering files and evidence are visible without requiring API key',()=>{
 const p=project();p.requirements=p.requirements.slice(0,1);p.docs=[];assert.equal(planBatch(p).ready.length,0);assert.equal(workflowSummary(p).next.action,'library');
 p.docs=[{id:'d',role:'product',itemIds:['x']}];assert.equal(workflowSummary(p).next.action,'search');
 p.evidence=[{id:'m',docId:'d',requirementIds:['1'],quote:'ports',reviewed:false}];assert.equal(workflowSummary(p).next.action,'proof');
 p.evidence[0].reviewed=true;p.rows[1].proposal='ports';assert.equal(workflowSummary(p).next.action,'decision');
 p.rows[1].comparison=STATUS.pass;assert.equal(workflowSummary(p).readyToSubmit,true);
});
test('metadata recovery restores only the unchanged latest revision',()=>{
 const p=project(),before={...p,requirements:[]},record={before,revision:'a'};assert.equal(recoverMetadata(p,record).requirements.length,0);
 assert.throws(()=>recoverMetadata({...p,updatedAt:'b'},record),/เปลี่ยน/);assert.throws(()=>recoverMetadata(p,null));
});
test('unresolved source coverage blocks Auto and exports even when known clauses are reviewed',()=>{
 const p=project();p.requirements.forEach(r=>r.reviewed=true);p.sourceCoveragePending=true;p.mode='auto';
 assert.equal(planBatch(p).ready.length,0);assert.equal(workflowSummary(p).next.action,'pages');assert.ok(workflowSummary(p).blockers.some(e=>e.includes('ครบถ้วน')));
});

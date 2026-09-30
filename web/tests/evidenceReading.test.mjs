import test from 'node:test';
import assert from 'node:assert/strict';
import {pageCandidates,assessClause} from '../src/lib/evidenceSearch.mjs';
const doc={id:'d',role:'product',itemIds:['x'],pageCount:1};
const page={page:1,items:[{text:'ports',box:[.5,.1,.1,.02]},{text:'24',box:[.3,.1,.1,.02]}]};
test('generated proof uses visual reading and always needs explicit source review',()=>{
 const [c]=pageCandidates('24 ports',doc,[page]);assert.equal(c.quote,'24 ports');assert.equal(c.reviewed,false);
});
test('relevant numeric failures are kept while unrelated metrics cannot prove the clause',()=>{
 assert.equal(pageCandidates('At least 48 ports',doc,[page]).length,1);
 const unrelated={page:1,items:[{text:'24 Gbps',box:[.3,.1,.2,.02]}]};assert.equal(pageCandidates('At least 48 ports',doc,[unrelated]).length,0);
});
test('reviewed same physical proof is reused and not made pending by duplicate candidates',async()=>{
 const [c]=pageCandidates('24 ports',doc,[page]);
 const p={requirements:[{id:'1',reviewed:true,textSnapshot:'24 ports'}],rows:{1:{itemIds:['x'],mode:'manual'}},unreadablePages:[],docs:[doc],products:[{id:'x',name:'Test'}],evidence:[{...c,id:'m',requirementIds:['1'],reviewed:true}]};
 const result=await assessClause(p,'1',async()=>({pages:[page]}));assert.equal(result.candidates.length,0);assert.equal(result.assessment.status,'pass');
 p.evidence=[];const fresh=await assessClause(p,'1',async()=>({pages:[page]}));assert.equal(fresh.assessment.status,'pending');
});
test('shared corrected region is canonical for assessment of a newly linked clause',async()=>{
 const [c]=pageCandidates('24 ports',doc,[page]);
 const p={mode:'auto',requirements:[{id:'1',reviewed:true,textSnapshot:'IPv6'},{id:'2',reviewed:true,textSnapshot:'At least 48 ports'}],rows:{1:{itemIds:['x']},2:{itemIds:['x']}},unreadablePages:[],docs:[doc],products:[{id:'x',name:'Test'}],evidence:[{...c,id:'m',quote:'48 ports',sourceMethod:'corrected',requirementIds:['1'],reviewed:true}]};
 const result=await assessClause(p,'2',async()=>({pages:[page]}));assert.equal(result.assessment.status,'pass');assert.equal(result.candidates[0].quote,'48 ports');assert.match(result.proposal,/48 ports/);assert.doesNotMatch(result.proposal,/24 ports/);
});

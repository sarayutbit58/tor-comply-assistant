import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateProject,STATUS,exportProblems} from '../src/lib/projectModel.mjs';
const old=()=>({id:'p',requirements:[{id:'1',textSnapshot:'IPv6',reviewed:true}],rows:{1:{itemIds:['x'],proposal:'IPv6',comparison:STATUS.pass,decisionSource:'auto'}},products:[{id:'x'}],docs:[{id:'d',role:'product',itemIds:['x'],pageCount:1}],evidence:[{id:'m',docId:'d',pdfPage:1,box:[.1,.1,.4,.05],quote:'IPv6',requirementIds:['1'],sourceMethod:'text',reviewed:true}],unreadablePages:[]});
test('legacy auto-approved text citations require source review after upgrade without losing originals/answers',()=>{
 const p=old(),next=migrateProject(p);assert.equal(next.evidence[0].reviewed,false);assert.equal(next.rows[1].comparison,STATUS.pending);assert.equal(next.rows[1].proposal,'IPv6');assert.equal(next.docs[0].id,'d');assert.ok(exportProblems(next).length);assert.equal(p.evidence[0].reviewed,true);
});
test('new policy keeps explicitly reviewed citations through repeated archive migration',()=>{
 const p={...old(),sourceReviewPolicy:2};assert.equal(migrateProject(migrateProject(p)).evidence[0].reviewed,true);
});

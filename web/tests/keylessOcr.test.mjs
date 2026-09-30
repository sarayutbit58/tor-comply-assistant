import test from 'node:test';
import assert from 'node:assert/strict';
import {createAiSession} from '../src/lib/aiSession.mjs';
import {webcrypto} from 'node:crypto';
const engine=await import('../src/lib/localOcr.mjs').catch(()=>null);
test('timeout during worker initialization returns promptly and disposes late worker',async()=>{
 let terminated=0;
 await assert.rejects(()=>engine.recognizeLocal('image',{timeoutMs:1,factory:()=>new Promise(resolve=>setTimeout(()=>resolve({recognize:async()=>({data:{text:'late'}}),terminate:async()=>{terminated++;}}),15))}),/นาน/);
 await new Promise(resolve=>setTimeout(resolve,25));assert.equal(terminated,1);
});
test('local OCR is the default and captures work without a key or cloud consent',()=>{
 const session=createAiSession({cryptoApi:webcrypto,fetchImpl:()=>{throw new Error('must never send');}});
 assert.equal(session.getSnapshot().ocrProvider,'local');
 const ticket=session.captureFor('ocr');assert.equal(ticket.provider,'local');
 session.assertTicket(ticket);
 session.setProvider('ocr','openrouter');
 assert.throws(()=>session.assertTicket(ticket),/ยกเลิก|เปลี่ยน/);
});
test('local worker returns text and is always terminated, including recognition failure',async()=>{
 assert.ok(engine,'local OCR adapter is missing');
 let terminated=0;
 const factory=async()=>({recognize:async()=>({data:{text:'ข้อ 6.1 ให้บริการ NOC',confidence:92}}),terminate:async()=>{terminated++;}});
 const result=await engine.recognizeLocal('synthetic-image',{factory});
 assert.equal(result.text,'ข้อ 6.1 ให้บริการ NOC');assert.equal(result.model,'local-tesseract');assert.equal(terminated,1);
 const failed=async()=>({recognize:async()=>{throw new Error('bad image');},terminate:async()=>{terminated++;}});
 await assert.rejects(()=>engine.recognizeLocal('bad',{factory:failed}),/bad image/);assert.equal(terminated,2);
});
test('cancelled local recognition cannot apply a result after source/provider changes',async()=>{
 assert.ok(engine,'local OCR adapter is missing');
 let callback,release,cancelled=false,terminated=0;
 const operation=engine.recognizeLocal('image',{
  factory:async()=>({recognize:()=>new Promise(resolve=>{release=resolve;}),terminate:async()=>{terminated++;}}),
  assertCurrent:()=>{if(cancelled)throw new Error('งานเดิมถูกยกเลิก');},
  subscribe:fn=>{callback=fn;return()=>{callback=null;};},
 });
 while(!release)await new Promise(resolve=>setTimeout(resolve,1));
 cancelled=true;callback();release({data:{text:'stale'}});
 await assert.rejects(()=>operation,/ยกเลิก/);assert.equal(terminated,1);
});
test('cancelled or terminated workers cannot emit late progress into the current dialog',async()=>{
 let callback,logger,started,cancelled=false;const progress=[];
 const operation=engine.recognizeLocal('image',{factory:async(a,b,options)=>{logger=options.logger;return {recognize:()=>{started=true;return new Promise(()=>{});},terminate:async()=>{}};},assertCurrent:()=>{if(cancelled)throw new Error('cancelled');},subscribe:fn=>{callback=fn;return()=>{};},onProgress:p=>progress.push(p)});
 while(!started)await new Promise(resolve=>setTimeout(resolve,1));cancelled=true;callback();await assert.rejects(()=>operation,/cancelled/);logger({status:'initializing api',progress:0});assert.equal(progress.length,0);
});
test('OCR progress copy describes preparation/reading without exposing engine API terms',()=>{
 assert.ok(engine.ocrProgressMessage);assert.doesNotMatch(engine.ocrProgressMessage({status:'initializing api',progress:0}),/api/i);assert.match(engine.ocrProgressMessage({status:'recognizing text',progress:.5}),/อ่านข้อความ.*50%/);assert.doesNotMatch(engine.ocrProgressMessage({status:'unknown',progress:Infinity}),/Infinity/);
});

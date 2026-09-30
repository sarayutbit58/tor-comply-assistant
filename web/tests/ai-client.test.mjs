import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const client=await import('../src/lib/aiSession.mjs').catch(()=>null);
const listed={models:[{id:'gpt-6-luna',tier:'easy',label:'ง่าย'},{id:'gpt-6-astra',tier:'hard',label:'ยาก'}],listedAt:1};
test('each key submission refreshes models without cookies and secrets in state',async()=>{
 assert.ok(client,'AI session is not implemented');
 const calls=[];
 const session=client.createAiSession({cryptoApi:webcrypto,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(listed);}});
 await session.connect('openai','sk-QA-key-111111111111');
 await session.connect('openai','sk-QA-key-222222222222');
 assert.equal(calls.length,2);
 assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.cache,'no-store');
 assert.equal(session.getSnapshot().openai.llmModel,'gpt-6-luna');
 assert.equal(JSON.stringify(session.getSnapshot()).includes('sk-QA-key'),false);
 await assert.rejects(()=>session.request('openai','draft',{requirement:'IPv6',candidates:[]}),/อนุญาต/);
 session.clear();assert.equal(session.getSnapshot().openai.phase,'disconnected');
});
test('new key and tab clear discard a late model list and cancel requests',async()=>{
 assert.ok(client,'AI session is not implemented');
 const pending=[];
 const session=client.createAiSession({cryptoApi:webcrypto,fetchImpl:(url,options)=>new Promise(resolve=>pending.push({resolve,options}))});
 const old=session.connect('openai','sk-QA-key-AAAAAAAAAAAA');
 while(pending.length<1)await new Promise(resolve=>setTimeout(resolve,1));
 const current=session.connect('openai','sk-QA-key-BBBBBBBBBBBB');
 while(pending.length<2)await new Promise(resolve=>setTimeout(resolve,1));
 pending[1].resolve(Response.json(listed));await current;
 pending[0].resolve(Response.json({models:[],listedAt:0}));await old;
 assert.equal(session.getSnapshot().openai.llmModel,'gpt-6-luna');
 assert.equal(pending[0].options.signal.aborted,true);
 session.setConsent(true);
 const operation=session.request('openai','ocr',{image:'data:image/png;base64,AAAA'});
 while(pending.length<3)await new Promise(resolve=>setTimeout(resolve,1));
 session.clear();assert.equal(pending[2].options.signal.aborted,true);
 pending[2].resolve(Response.json({text:'late OCR'}));
 await assert.rejects(()=>operation,/Key|ยกเลิก/);
 assert.equal(session.getSnapshot().consent,false);
});

test('preflight action cannot switch to a reconnected key before sending documents',async()=>{
 let calls=0;
 const session=client.createAiSession({cryptoApi:webcrypto,fetchImpl:async()=>{calls++;return Response.json(listed);}});
 await session.connect('openai','sk-QA-key-AAAAAAAAAAAA');session.setConsent(true);
 assert.equal(typeof session.capture,'function');
 const captured=session.capture('openai');
 await session.connect('openai','sk-QA-key-BBBBBBBBBBBB');
 await assert.rejects(()=>session.request('openai','ocr',{image:'data:image/png;base64,AAAA'},captured),/เปลี่ยน|ยกเลิก/);
 assert.equal(calls,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
const relay=await import('../src/lib/aiRelay.mjs').catch(()=>null);
const secret='sk-QA-secret-never-return-12345678';
const request=(body,extra={})=>new Request('https://example.test/api/ai',{
 method:'POST',headers:{origin:'https://example.test','content-type':'application/json',authorization:'Bearer '+secret,...extra},
 body:JSON.stringify(body),
});
test('relay refreshes provider models with supplied credentials and no cache',async()=>{
 assert.ok(relay,'stateless relay is not implemented');
 let seen;
 const response=await relay.handleAiRequest(request({provider:'openai',action:'models'}),async(url,options)=>{
   seen={url,options};return Response.json({data:[{id:'gpt-6-luna'}]});
 });
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(seen.url,'https://api.openai.com/v1/models');assert.equal(seen.options.cache,'no-store');
 assert.equal(seen.options.headers.Authorization,'Bearer '+secret);
 assert.equal((await response.text()).includes(secret),false);
});
test('relay rejects cross-origin, unsupported model and URL injection before network',async()=>{
 assert.ok(relay,'stateless relay is not implemented');
 let calls=0;const fetcher=async()=>{calls++;return Response.json({});};
 assert.equal((await relay.handleAiRequest(request({provider:'openai',action:'models'},{origin:'https://evil.test'}),fetcher)).status,403);
 assert.equal((await relay.handleAiRequest(request({provider:'openai',action:'ocr',model:'gpt-image-2',image:'data:image/png;base64,AAAA'}),fetcher)).status,400);
 assert.equal((await relay.handleAiRequest(request({provider:'openai',action:'models',url:'https://evil.test'}),fetcher)).status,400);
 assert.equal(calls,0);
});
test('relay sanitizes provider errors without returning key or prompt',async()=>{
 assert.ok(relay,'stateless relay is not implemented');
 const response=await relay.handleAiRequest(request({provider:'typesafe',action:'models'}),async()=>Response.json({error:{message:secret}},{status:401}));
 assert.equal(response.status,401);assert.equal((await response.text()).includes(secret),false);
});
test('OCR inference is bounded, stateless and returns only recognized text',async()=>{
 assert.ok(relay,'stateless relay is not implemented');
 let payload;
 const response=await relay.handleAiRequest(request({provider:'openai',action:'ocr',model:'gpt-6-luna',image:'data:image/png;base64,aGVsbG8='}),async(url,options)=>{
   payload=JSON.parse(options.body);return Response.json({status:'completed',model:'gpt-6-luna',output:[{type:'message',content:[{type:'output_text',text:'5.1 รองรับ IPv6'}]}]});
 });
 assert.equal(response.status,200);assert.equal(payload.store,false);assert.equal(payload.tools,undefined);
 assert.equal(payload.max_output_tokens,4096);assert.equal((await response.json()).text,'5.1 รองรับ IPv6');
});

test('TypeSafe refreshes Jev and builds typed relevance/support questions',async()=>{
 const models=await relay.handleAiRequest(request({provider:'typesafe',action:'models'}),async url=>{
  assert.equal(url,'https://api.typesafe.ai/v1/models');return Response.json({models:[{name:'jev-latest'}]});
 });
 assert.equal((await models.json()).model,'jev-latest');
 const input={provider:'typesafe',action:'semantic',model:'jev-latest',requirement:'รองรับ IPv6',candidates:[{id:'e',role:'product',quote:'Supports IPv6'}]};
 let payload;
 const output=await relay.handleAiRequest(request(input),async(url,options)=>{
  assert.equal(url,'https://api.typesafe.ai/v1/systemone');payload=JSON.parse(options.body);
  return Response.json({model:'jev-1.13.0',answers:{e0:{type:'choice',choice:'supports',confidence:.9},r0:{type:'noul',noul:.95}}});
 });
 assert.equal(output.status,200);assert.equal(payload.questions.e0.type,'choice');
 assert.equal(payload.questions.r0.type,'noul');assert.equal(payload.state.candidates[0].quote,'Supports IPv6');
});

test('LLM output requires source TOR quotes and existing evidence citations',async()=>{
 const input={provider:'openai',action:'draft',model:'gpt-6-luna',requirement:'Support IPv6',candidates:[{id:'e',role:'product',quote:'Supports IPv6'}]};
 const result={conditions:[{sourceQuote:'Support IPv6',description:'IPv6'}],draft:[{text:'รองรับ IPv6',citations:[{id:'e',quote:'Supports IPv6'}]}]};
 let sent;
 const responder=async(url,options)=>{sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});};
 assert.equal((await relay.handleAiRequest(request(input),responder)).status,200);
 assert.equal(sent.text.format.strict,true);assert.equal(sent.store,false);
 result.draft[0].citations[0].id='invented';
 assert.equal((await relay.handleAiRequest(request(input),responder)).status,422);
 input.candidates[0].role='tor';
 assert.equal((await relay.handleAiRequest(request(input),responder)).status,400);
});

test('relay rejects oversized and malformed inputs, times out and redacts quota errors',async()=>{
 const oversize={provider:'openai',action:'ocr',model:'gpt-6-luna',image:'data:image/png;base64,'+'A'.repeat(3*1024*1024)};
 assert.equal((await relay.handleAiRequest(request(oversize),()=>{throw new Error('must not fetch');})).status,413);
 const invalid=new Request('https://example.test/api/ai',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json',authorization:'Bearer '+secret},body:'{'});
 assert.equal((await relay.handleAiRequest(invalid,()=>{})).status,400);
 const timeout=await relay.handleAiRequest(request({provider:'openai',action:'models'}),async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')))),{timeoutMs:5});
 assert.equal(timeout.status,504);
 const quota=await relay.handleAiRequest(request({provider:'openai',action:'models'}),async()=>Response.json({error:secret},{status:429}));
 assert.equal(quota.status,429);assert.equal((await quota.text()).includes(secret),false);
 const malformed=await relay.handleAiRequest(request({provider:'openai',action:'models'}),async()=>new Response('not JSON'));
 assert.equal(malformed.status,502);
});

test('successful provider objects cannot forward unexpected credential metadata',async()=>{
 const input={provider:'typesafe',action:'semantic',model:'jev-latest',requirement:'IPv6',candidates:[{id:'e',role:'product',quote:'IPv6'}]};
 const valid={model:'jev-1.13.0',answers:{e0:{type:'choice',choice:'supports',confidence:.9,unexpected:secret},r0:{type:'noul',noul:.95},unexpected:{credential:secret}}};
 const semantic=await relay.handleAiRequest(request(input),async()=>Response.json(valid));
 assert.equal((await semantic.text()).includes(secret),false);
 const draftInput={...input,provider:'openai',action:'draft',model:'gpt-6-luna'};
 const output={conditions:[{sourceQuote:'IPv6',description:'IPv6',unexpected:secret}],draft:[],credential:secret};
 const draft=await relay.handleAiRequest(request(draftInput),async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]}));
 assert.equal((await draft.text()).includes(secret),false);
});

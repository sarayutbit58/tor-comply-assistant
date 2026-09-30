import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handleAiRequest} from '../src/lib/aiRelay.mjs';
import {createAiSession} from '../src/lib/aiSession.mjs';
import {createKeyVault} from '../src/lib/ephemeralKeys.mjs';
const policy=await import('../src/lib/openRouterPolicy.mjs').catch(()=>null);
const secret='sk-or-v1-QA-only-not-a-real-key-123456';
const model=(id,vision=true,structured=true)=>({id,architecture:{input_modalities:vision?['text','image']:['text'],output_modalities:['text']},supported_parameters:structured?['structured_outputs','response_format']:['max_tokens']});
const catalogue={data:[model('google/gemini-3.5-flash-lite'),model('openai/gpt-6-luna',false),model('google/gemini-3.8-flash'),model('anthropic/claude-sonnet-5.5'),model('anthropic/claude-opus-5.5')]};
const request=body=>new Request('https://example.test/api/ai',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json',authorization:'Bearer '+secret},body:JSON.stringify({provider:'openrouter',...body})});
const validDraft={conditions:[{sourceQuote:'Support IPv6',description:'IPv6'}],draft:[{text:'รองรับ IPv6',citations:[{id:'e1',quote:'IPv6 supported'}]}]};
const context={requirement:'Support IPv6',candidates:[{id:'e1',role:'product',quote:'IPv6 supported'}]};

test('OpenRouter recommendations separate OCR vision and structured draft capabilities',()=>{
 assert.ok(policy,'OpenRouter model policy is missing');
 const models=policy.recommendedOpenRouterModels(catalogue);
 assert.equal(models.length,5);assert.equal(models[0].tier,'easy');
 assert.equal(models.find(m=>m.id==='openai/gpt-6-luna').canOcr,false);
 assert.equal(models.find(m=>m.id==='openai/gpt-6-luna').canDraft,true);
 assert.equal(policy.allowedOpenRouterModel('openrouter/auto'),false);
 assert.equal(policy.allowedOpenRouterModel('https://evil.test/model'),false);
});

test('OpenRouter key is authenticated before the public models catalogue and metadata is discarded',async()=>{
 const calls=[];
 const response=await handleAiRequest(request({action:'models'}),async(url,options)=>{
   calls.push(url);assert.equal(options.headers.Authorization,'Bearer '+secret);
   assert.equal(options.cache,'no-store');
   return url.endsWith('/key')?Response.json({data:{label:secret,usage:999}}):Response.json(catalogue);
 });
 assert.equal(response.status,200);
 assert.deepEqual(calls,['https://openrouter.ai/api/v1/key','https://openrouter.ai/api/v1/models']);
 const body=await response.json();assert.equal(body.models.length,5);assert.equal(JSON.stringify(body).includes(secret),false);
});

test('invalid OpenRouter key cannot be approved by a public model response',async()=>{
 const calls=[];
 const response=await handleAiRequest(request({action:'models'}),async url=>{calls.push(url);return Response.json({error:{message:secret}},{status:401});});
 assert.equal(response.status,401);assert.equal(calls.length,1);
 assert.equal((await response.text()).includes(secret),false);
});

test('OpenRouter draft uses chat JSON schema and retains citation validation',async()=>{
 let payload;
 const response=await handleAiRequest(request({action:'draft',model:'google/gemini-3.5-flash-lite',...context}),async(url,options)=>{
   if(url.endsWith('/models'))return Response.json(catalogue);
   assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');payload=JSON.parse(options.body);
   return Response.json({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(validDraft)}}]});
 });
 assert.equal(response.status,200);assert.equal(payload.response_format.json_schema.strict,true);
 assert.equal(payload.provider.require_parameters,true);assert.equal(payload.provider.allow_fallbacks,false);
 assert.equal(payload.provider.data_collection,'deny');assert.equal(payload.messages[0].role,'system');
 assert.equal((await response.json()).result.draft[0].citations[0].id,'e1');
});

test('OpenRouter OCR rejects text-only models before inference and sends selected image only',async()=>{
 let inference=0,payload;
 const fetcher=async(url,options)=>{
   if(url.endsWith('/models'))return Response.json(catalogue);
   inference++;payload=JSON.parse(options.body);
   return Response.json({choices:[{finish_reason:'stop',message:{role:'assistant',content:'5.1 รองรับ IPv6'}}]});
 };
 const wrong=await handleAiRequest(request({action:'ocr',model:'openai/gpt-6-luna',image:'data:image/png;base64,aGVsbG8='}),fetcher);
 assert.equal(wrong.status,400);assert.equal(inference,0);
 const right=await handleAiRequest(request({action:'ocr',model:'google/gemini-3.5-flash-lite',image:'data:image/png;base64,aGVsbG8='}),fetcher);
 assert.equal(right.status,200);assert.equal(inference,1);
 assert.equal(payload.messages[1].content[1].type,'image_url');assert.equal(payload.max_tokens,4096);
 assert.equal((await right.json()).text,'5.1 รองรับ IPv6');
});

test('OpenRouter truncated output, fake citations, embedded errors and billing failures stay safe',async()=>{
 for(const fixture of [
   {choices:[{finish_reason:'length',message:{content:JSON.stringify(validDraft)}}]},
   {choices:[{finish_reason:'stop',message:{content:JSON.stringify({...validDraft,draft:[{text:'fake',citations:[{id:'missing',quote:'10G'}]}]})}}]},
   {error:{code:402,message:secret}},
 ]) {
   const response=await handleAiRequest(request({action:'draft',model:'google/gemini-3.5-flash-lite',...context}),async url=>url.endsWith('/models')?Response.json(catalogue):Response.json(fixture));
   assert.notEqual(response.status,200);assert.equal((await response.text()).includes(secret),false);
 }
 const billing=await handleAiRequest(request({action:'models'}),async()=>Response.json({error:{message:secret}},{status:402}));
 assert.equal(billing.status,402);assert.match((await billing.json()).error,/เครดิต|วงเงิน/);
});

test('OpenRouter vault/session stay independent and selected provider is captured before preflight',async()=>{
 const vault=createKeyVault(webcrypto);await vault.set('openrouter',secret);
 assert.equal(vault.has('openrouter'),true);assert.equal(vault.has('openai'),false);vault.clear();
 const calls=[];
 const session=createAiSession({cryptoApi:webcrypto,fetchImpl:async(url,options)=>{
   const body=JSON.parse(options.body);calls.push(body);
   return Response.json({models:policy.recommendedOpenRouterModels(catalogue),listedAt:1});
 }});
 await session.connect('openrouter',secret);await session.connect('openrouter',secret);
 assert.equal(calls.length,2);session.setConsent(true);session.setProvider('llm','openrouter');
 const ticket=session.captureFor('draft');assert.equal(ticket.provider,'openrouter');
 session.setProvider('llm','openai');session.setProvider('llm','openrouter');
 await assert.rejects(()=>session.request('openrouter','draft',context,ticket),/เปลี่ยน|ยกเลิก/);
 assert.equal(calls.length,2);assert.equal(JSON.stringify(session.getSnapshot()).includes(secret),false);
 session.clear();assert.equal(session.getSnapshot().openrouter.phase,'disconnected');
});

test('selecting OpenRouter while its key is being checked does not strand connection state',async()=>{
 let resolveList,options;
 const session=createAiSession({cryptoApi:webcrypto,fetchImpl:(url,next)=>{options=next;return new Promise(resolve=>{resolveList=resolve;});}});
 const connect=session.connect('openrouter',secret);
 while(!resolveList)await new Promise(resolve=>setTimeout(resolve,1));
 session.setProvider('llm','openrouter');
 resolveList(Response.json({models:policy.recommendedOpenRouterModels(catalogue),listedAt:1}));await connect;
 assert.equal(options.signal.aborted,false);
 assert.equal(session.getSnapshot().openrouter.phase,'ready');
});

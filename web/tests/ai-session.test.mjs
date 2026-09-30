import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const policy=await import('../src/lib/aiModelPolicy.mjs').catch(()=>null);
const keys=await import('../src/lib/ephemeralKeys.mjs').catch(()=>null);
const integrity=await import('../src/lib/aiIntegrity.mjs').catch(()=>null);
const requireModule=(module,name)=>assert.ok(module,name+' feature is not implemented');

test('recommendations use only fresh available vision/text models and default to easy',()=>{
  requireModule(policy,'model policy');
  const raw={data:['gpt-6-astra','gpt-6-sol','gpt-6.1-sol','gpt-5.6-luna','gpt-6-luna','gpt-image-2','unknown'].map(id=>({id}))};
  const result=policy.recommendedModels(raw);
  assert.equal(result.length,5);
  assert.equal(policy.defaultEasyModel(result),'gpt-6-luna');
  assert.equal(policy.defaultEasyModel(policy.recommendedModels({data:[{id:'gpt-6-astra'}]})),'');
  assert.equal(policy.allowedOpenAiModel('gpt-image-2'),false);
  assert.equal(policy.pickSystemOneModel({models:[{name:'jev-preview'},{name:'jev-latest'}]}),'jev-latest');
});

test('two independent vaults retain no plaintext, clear and reject late replacement',async()=>{
  requireModule(keys,'credential vault');
  const vault=keys.createKeyVault(webcrypto),other=keys.createKeyVault(webcrypto);
  const secret='sk-QA-SECRET-sentinel-1234567890';
  await vault.set('openai',secret);
  assert.equal(vault.has('openai'),true);assert.equal(other.has('openai'),false);
  assert.equal(JSON.stringify(vault).includes(secret),false);
  assert.equal(await vault.use('openai',key=>key===secret),true);
  const pending=vault.set('typesafe',secret);vault.clear();await pending;
  assert.equal(vault.has('typesafe'),false);assert.equal(vault.has('openai'),false);
  await assert.rejects(()=>vault.use('openai',()=>true),/API Key/);
});

const project={
 id:'p',mode:'auto',unreadablePages:[],requirements:[{id:'5.1',textSnapshot:'Support IPv6',reviewed:true}],
 rows:{'5.1':{itemIds:['a'],scope:'offering',proposal:''}},
 products:[{id:'a',name:'QA A'}],docs:[{id:'doc',name:'QA',role:'product',itemIds:['a'],searchText:'Support IPv6',pageCount:1}],
 evidence:[],
};
const candidates=[{id:'c1',docId:'doc',pdfPage:1,quote:'Support IPv6',box:[.1,.1,.5,.1],reviewed:true}];
test('changed input invalidates delayed AI results and fabricated citations are rejected',()=>{
  requireModule(integrity,'AI result integrity');
  const original=integrity.clauseFingerprint(project,'5.1');
  const edited=structuredClone(project);edited.rows['5.1'].itemIds=[];
  assert.notEqual(integrity.clauseFingerprint(edited,'5.1'),original);
  const output={conditions:[{sourceQuote:'Support IPv6',description:'IPv6'}],draft:[{text:'รองรับ IPv6',citations:[{id:'c1',quote:'Support IPv6'}]}]};
  assert.equal(integrity.validateDraft(output,'Support IPv6',candidates).draft.length,1);
  const fake=structuredClone(output);fake.draft[0].citations[0].quote='Supports 10G';
  assert.throws(()=>integrity.validateDraft(fake,'Support IPv6',candidates),/อ้างอิง/);
  const wrong=structuredClone(output);wrong.conditions[0].sourceQuote='Support 10G';
  assert.throws(()=>integrity.validateDraft(wrong,'Support IPv6',candidates),/TOR/);
});

test('vault uses fresh IVs and nonextractable keys and rejects ciphertext tampering',async()=>{
  const observed=[];
  const wrapped={getRandomValues:array=>webcrypto.getRandomValues(array),subtle:{
    generateKey:(...args)=>webcrypto.subtle.generateKey(...args),
    encrypt:async(algorithm,key,bytes)=>{const cipher=await webcrypto.subtle.encrypt(algorithm,key,bytes);observed.push({iv:[...algorithm.iv],key,cipher:[...new Uint8Array(cipher)]});return cipher;},
    decrypt:(...args)=>webcrypto.subtle.decrypt(...args),
  }};
  const vault=keys.createKeyVault(wrapped);
  await vault.set('openai','sk-QA-same-key-123456789');
  await vault.set('openai','sk-QA-same-key-123456789');
  assert.notDeepEqual(observed[0].iv,observed[1].iv);
  assert.notDeepEqual(observed[0].cipher,observed[1].cipher);
  assert.equal(observed[0].key.extractable,false);
  await assert.rejects(()=>webcrypto.subtle.exportKey('raw',observed[0].key));
  wrapped.subtle.encrypt=async(...args)=>{const cipher=new Uint8Array(await webcrypto.subtle.encrypt(...args));cipher[0]^=1;return cipher.buffer;};
  await vault.set('openai','sk-QA-tampered-key-123456');
  await assert.rejects(()=>vault.use('openai',()=>true));
});

test('versioned snapshots stay in their model family and Jev stable falls back correctly',()=>{
  assert.equal(policy.allowedOpenAiModel('gpt-6-luna-2026-09-30'),true);
  assert.equal(policy.allowedOpenAiModel('gpt-6-luna-evil'),false);
  assert.equal(policy.allowedOpenAiModel('gpt-6x1-sol-2026-09-30'),false);
  assert.equal(policy.recommendedModels({data:[{id:'gpt-6-luna-2026-09-30'}]})[0].tier,'easy');
  assert.equal(policy.pickSystemOneModel({models:[{name:'jev-1.9.0'},{name:'jev-1.13.0'}]}),'jev-1.13.0');
  assert.equal(policy.pickSystemOneModel({models:[{name:'jev-preview'}]}),'');
});

test('AI context excludes TOR/template and evidence for an unselected offering',()=>{
  const sample=structuredClone(project);
  sample.docs.push({id:'tor',role:'tor',itemIds:['a']},{id:'template',role:'template',itemIds:['a']},{id:'other',role:'product',itemIds:['b']});
  const extra=['tor','template','other'].map(id=>({...candidates[0],id,docId:id}));
  assert.deepEqual(integrity.aiCandidates(sample,'5.1',[...candidates,...extra]).map(c=>c.docId),['doc']);
});

test('AI shortlist sends one physical excerpt when a saved highlight and search match overlap',()=>{
 const sample=structuredClone(project);
 sample.evidence=[{...candidates[0],id:'saved',requirementIds:['5.1']}];
 const result=integrity.aiCandidates(sample,'5.1',candidates);
 assert.equal(result.length,1);
 assert.equal(result[0].id,'saved');
});

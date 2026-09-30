import {createKeyVault} from './ephemeralKeys.mjs';
import {allowedOpenAiModel,defaultEasyModel} from './aiModelPolicy.mjs';
import {allowedOpenRouterModel} from './openRouterPolicy.mjs';
const PROVIDERS=['openai','openrouter','typesafe'];
const emptyProvider=()=>({phase:'disconnected',models:[],model:'',llmModel:'',ocrModel:'',error:'',listedAt:null});
const emptySession=()=>({openai:emptyProvider(),openrouter:emptyProvider(),typesafe:emptyProvider(),consent:false,llmProvider:'openai',ocrProvider:'local'});
const SERVER_SNAPSHOT=emptySession();
export function createAiSession({cryptoApi=globalThis.crypto,fetchImpl=(...args)=>fetch(...args)}={}) {
  const vault=createKeyVault(cryptoApi),listeners=new Set(),controllers=new Map();
  const generation={openai:0,openrouter:0,typesafe:0};
  let state=emptySession(),workVersion=0;
  const emit=next=>{state=next;for(const listener of listeners)listener();};
  const update=(provider,patch)=>emit({...state,[provider]:{...state[provider],...patch}});
  const cancel=provider=>{generation[provider]++;for(const [controller,owner] of controllers)if(owner.provider===provider)controller.abort();};
  const cancelWork=()=>{workVersion++;for(const [controller,owner] of controllers)if(owner.action!=='models')controller.abort();};
  const check=provider=>{if(!PROVIDERS.includes(provider))throw new Error('ผู้ให้บริการไม่ถูกต้อง');};
  const providerFor=action=>action==='semantic'?'typesafe':action==='ocr'?state.ocrProvider:action==='draft'?state.llmProvider:null;
  const assertTicket=ticket=>{
    if(ticket?.provider==='local'){
      if(ticket.action!=='ocr'||(!ticket.explicitLocal&&state.ocrProvider!=='local')||ticket.workVersion!==workVersion)throw new Error('งาน OCR ในเครื่องเดิมถูกยกเลิกหลังเปลี่ยนการทำงาน');
      return;
    }
    check(ticket?.provider);
    if(!state.consent||state[ticket.provider].phase!=='ready'||generation[ticket.provider]!==ticket.version||ticket.workVersion!==workVersion||(ticket.action&&providerFor(ticket.action)!==ticket.provider))throw new Error('การเชื่อมต่อ/สิทธิ์ส่งข้อมูลเปลี่ยนแล้ว งานเดิมถูกยกเลิก');
  };
  async function send(provider,body) {
    const version=generation[provider],work=workVersion,controller=new AbortController();controllers.set(controller,{provider,action:body.action});
    try {
      const value=await vault.use(provider,async key=>{
        const response=await fetchImpl('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({provider,...body}),cache:'no-store',credentials:'omit',mode:'same-origin',signal:controller.signal});
        let raw;try{raw=await response.json();}catch{throw new Error('API คืนข้อมูลที่อ่านไม่ได้');}
        if(!response.ok)throw new Error(String(raw?.error||'เรียก API ไม่สำเร็จ').slice(0,200).replaceAll(key,'[REDACTED]'));
        return raw;
      });
      if(controller.signal.aborted||version!==generation[provider]||(body.action!=='models'&&work!==workVersion))throw new Error('คำขอเดิมถูกยกเลิกหลังเปลี่ยนการเชื่อมต่อ');
      return value;
    } finally {controllers.delete(controller);}
  }
  return {
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    getSnapshot:()=>state,
    getServerSnapshot:()=>SERVER_SNAPSHOT,
    capture(provider) {
      check(provider);
      if(!state.consent)throw new Error('อนุญาตส่งข้อความ/ภาพที่เลือกให้ API ในหน้าตั้งค่า AI ก่อน');
      if(state[provider].phase!=='ready')throw new Error('เชื่อมต่อ API Key ในแท็บนี้ก่อน');
      return {provider,version:generation[provider],workVersion};
    },
    assertTicket,
    cancelJobs(){cancelWork();emit({...state});},
    captureLocalOcr(){return {provider:'local',workVersion,version:0,action:'ocr',explicitLocal:true};},
    captureFor(action) {
      const provider=providerFor(action);
      if(provider==='local'&&action==='ocr')return {provider:'local',workVersion,version:0,action};
      check(provider);
      if(!state.consent)throw new Error('อนุญาตส่งข้อความ/ภาพที่เลือกให้ API ในหน้าตั้งค่า AI ก่อน');
      if(state[provider].phase!=='ready')throw new Error('เชื่อมต่อ API Key ของบริการที่เลือกในแท็บนี้ก่อน');
      return {provider,version:generation[provider],workVersion,action};
    },
    async connect(provider,secret) {
      check(provider);cancel(provider);vault.remove(provider);
      const version=generation[provider];update(provider,{...emptyProvider(),phase:'checking'});
      try {
        await vault.set(provider,secret);secret='';
        if(version!==generation[provider])return;
        const result=await send(provider,{action:'models'});
        if(version!==generation[provider])return;
        if(provider!=='typesafe') {
          const allowed=provider==='openai'?allowedOpenAiModel:allowedOpenRouterModel;
          if(!Array.isArray(result.models)||result.models.length>5||result.models.some(m=>!allowed(m.id)||!['easy','medium','hard'].includes(m.tier)||(provider==='openrouter'&&(typeof m.canDraft!=='boolean'||typeof m.canOcr!=='boolean'))))throw new Error('รายการโมเดลไม่ตรงรูปแบบ');
          const llm=defaultEasyModel(result.models.filter(m=>provider==='openai'||m.canDraft)),ocr=defaultEasyModel(result.models.filter(m=>provider==='openai'||m.canOcr));
          update(provider,{phase:'ready',models:result.models,llmModel:llm,ocrModel:ocr,listedAt:result.listedAt,error:''});
        } else {
          if(typeof result.model!=='string'||(result.model&&!/^jev-(latest|\d+\.\d+(?:\.\d+)?)$/.test(result.model)))throw new Error('รายการ Jev ไม่ตรงรูปแบบ');
          update(provider,{phase:'ready',model:result.model,listedAt:result.listedAt,error:''});
        }
      } catch(error) {
        if(version===generation[provider]){vault.remove(provider);update(provider,{...emptyProvider(),phase:'error',error:error.name==='AbortError'?'ยกเลิกการเชื่อมต่อแล้ว':error.message||'เชื่อมต่อไม่สำเร็จ'});}
      } finally {secret='';}
    },
    setProvider(kind,provider) {
      if(!['llm','ocr'].includes(kind)||!(kind==='ocr'?['local','openai','openrouter']:['openai','openrouter']).includes(provider))throw new Error('ผู้ให้บริการงานนี้ไม่ถูกต้อง');
      if(state[kind+'Provider']===provider)return;
      cancelWork();emit({...state,[kind+'Provider']:provider});
    },
    setModel(kind,id,provider=state[kind==='ocrModel'?'ocrProvider':'llmProvider']) {
      if(!['llmModel','ocrModel'].includes(kind)||!['openai','openrouter'].includes(provider)||!state[provider].models.some(m=>m.id===id&&(provider==='openai'||m[kind==='ocrModel'?'canOcr':'canDraft'])))throw new Error('เลือกโมเดลที่รองรับงานนี้จากรายการล่าสุด');
      cancel(provider);update(provider,{[kind]:id});
    },
    setConsent(value){if(!value)cancelWork();emit({...state,consent:Boolean(value)});},
    async request(provider,action,payload,ticket) {
      check(provider);
      if(!state.consent)throw new Error('อนุญาตส่งข้อความ/ภาพที่เลือกให้ API ในหน้าตั้งค่า AI ก่อน');
      if(state[provider].phase!=='ready')throw new Error('เชื่อมต่อ API Key ในแท็บนี้ก่อน');
      if(ticket){if(ticket.provider!==provider)throw new Error('ผู้ให้บริการของงานเดิมเปลี่ยนแล้ว');assertTicket(ticket);}
      if(ticket?.action&&ticket.action!==action)throw new Error('ชนิดงานเดิมเปลี่ยนแล้ว');
      const model=provider==='typesafe'?state.typesafe.model:action==='ocr'?state[provider].ocrModel:state[provider].llmModel;
      if(!model)throw new Error('ยังไม่มีโมเดลที่รองรับ เลือกโมเดลจากรายการล่าสุดก่อน');
      const result=await send(provider,{...payload,action,model});
      if(ticket)assertTicket(ticket);
      return result;
    },
    disconnect(provider){check(provider);cancel(provider);vault.remove(provider);update(provider,emptyProvider());},
    clear(){cancelWork();for(const provider of PROVIDERS)cancel(provider);vault.clear();emit(emptySession());},
  };
}
export const aiSession=createAiSession();

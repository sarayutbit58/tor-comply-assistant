import {createKeyVault} from './ephemeralKeys.mjs';
import {allowedOpenAiModel,defaultEasyModel} from './aiModelPolicy.mjs';
const emptyProvider=()=>({phase:'disconnected',models:[],model:'',llmModel:'',ocrModel:'',error:'',listedAt:null});
const emptySession=()=>({openai:emptyProvider(),typesafe:emptyProvider(),consent:false});
const SERVER_SNAPSHOT=emptySession();
export function createAiSession({cryptoApi=globalThis.crypto,fetchImpl=(...args)=>fetch(...args)}={}) {
  const vault=createKeyVault(cryptoApi),listeners=new Set(),controllers=new Map();
  const generation={openai:0,typesafe:0};
  let state=emptySession();
  const emit=next=>{state=next;for(const listener of listeners)listener();};
  const update=(provider,patch)=>emit({...state,[provider]:{...state[provider],...patch}});
  const cancel=provider=>{generation[provider]++;for(const [controller,owner] of controllers)if(owner===provider)controller.abort();};
  const check=provider=>{if(!['openai','typesafe'].includes(provider))throw new Error('ผู้ให้บริการไม่ถูกต้อง');};
  const assertTicket=ticket=>{
    check(ticket?.provider);
    if(!state.consent||state[ticket.provider].phase!=='ready'||generation[ticket.provider]!==ticket.version)throw new Error('การเชื่อมต่อ/สิทธิ์ส่งข้อมูลเปลี่ยนแล้ว งานเดิมถูกยกเลิก');
  };
  async function send(provider,body) {
    const version=generation[provider],controller=new AbortController();controllers.set(controller,provider);
    try {
      const value=await vault.use(provider,async key=>{
        const response=await fetchImpl('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({provider,...body}),cache:'no-store',credentials:'omit',mode:'same-origin',signal:controller.signal});
        let raw;try{raw=await response.json();}catch{throw new Error('API คืนข้อมูลที่อ่านไม่ได้');}
        if(!response.ok)throw new Error(String(raw?.error||'เรียก API ไม่สำเร็จ').slice(0,200).replaceAll(key,'[REDACTED]'));
        return raw;
      });
      if(controller.signal.aborted||version!==generation[provider])throw new Error('คำขอเดิมถูกยกเลิกหลังเปลี่ยนการเชื่อมต่อ');
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
      return {provider,version:generation[provider]};
    },
    assertTicket,
    async connect(provider,secret) {
      check(provider);cancel(provider);vault.remove(provider);
      const version=generation[provider];update(provider,{...emptyProvider(),phase:'checking'});
      try {
        await vault.set(provider,secret);secret='';
        if(version!==generation[provider])return;
        const result=await send(provider,{action:'models'});
        if(version!==generation[provider])return;
        if(provider==='openai') {
          if(!Array.isArray(result.models)||result.models.some(m=>!allowedOpenAiModel(m.id)||!['easy','medium','hard'].includes(m.tier)))throw new Error('รายการโมเดลไม่ตรงรูปแบบ');
          const easy=defaultEasyModel(result.models);
          update(provider,{phase:'ready',models:result.models,llmModel:easy,ocrModel:easy,listedAt:result.listedAt,error:''});
        } else {
          if(typeof result.model!=='string'||(result.model&&!/^jev-(latest|\d+\.\d+(?:\.\d+)?)$/.test(result.model)))throw new Error('รายการ Jev ไม่ตรงรูปแบบ');
          update(provider,{phase:'ready',model:result.model,listedAt:result.listedAt,error:''});
        }
      } catch(error) {
        if(version===generation[provider]){vault.remove(provider);update(provider,{...emptyProvider(),phase:'error',error:error.name==='AbortError'?'ยกเลิกการเชื่อมต่อแล้ว':error.message||'เชื่อมต่อไม่สำเร็จ'});}
      } finally {secret='';}
    },
    setModel(kind,id) {
      if(!['llmModel','ocrModel'].includes(kind)||!state.openai.models.some(m=>m.id===id))throw new Error('เลือกโมเดลจากรายการล่าสุด');
      cancel('openai');update('openai',{[kind]:id});
    },
    setConsent(value){emit({...state,consent:Boolean(value)});if(!value){cancel('openai');cancel('typesafe');}},
    async request(provider,action,payload,ticket) {
      check(provider);
      if(!state.consent)throw new Error('อนุญาตส่งข้อความ/ภาพที่เลือกให้ API ในหน้าตั้งค่า AI ก่อน');
      if(state[provider].phase!=='ready')throw new Error('เชื่อมต่อ API Key ในแท็บนี้ก่อน');
      if(ticket){if(ticket.provider!==provider)throw new Error('ผู้ให้บริการของงานเดิมเปลี่ยนแล้ว');assertTicket(ticket);}
      const model=provider==='typesafe'?state.typesafe.model:action==='ocr'?state.openai.ocrModel:state.openai.llmModel;
      if(!model)throw new Error('ยังไม่มีโมเดลที่รองรับ เลือกโมเดลจากรายการล่าสุดก่อน');
      const result=await send(provider,{...payload,action,model});
      if(ticket)assertTicket(ticket);
      return result;
    },
    disconnect(provider){check(provider);cancel(provider);vault.remove(provider);update(provider,emptyProvider());},
    clear(){cancel('openai');cancel('typesafe');vault.clear();emit(emptySession());},
  };
}
export const aiSession=createAiSession();

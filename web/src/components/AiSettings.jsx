'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {aiSession} from '@/lib/aiSession.mjs';
import {WorkspaceDialog} from './WorkspaceDialog';
export function useAiSession() {return useSyncExternalStore(aiSession.subscribe,aiSession.getSnapshot,aiSession.getServerSnapshot);}
export function AiSessionBoundary({children}) {
  useEffect(()=>{
    const clear=()=>aiSession.clear();
    const restore=event=>{if(event.persisted)clear();};
    window.addEventListener('pagehide',clear);window.addEventListener('pageshow',restore);
    return()=>{window.removeEventListener('pagehide',clear);window.removeEventListener('pageshow',restore);clear();};
  },[]);
  return children;
}
function ProviderKey({provider,title,status}) {
  const inputRef=useRef(null);
  useEffect(()=>{
    const reset=()=>{if(inputRef.current)inputRef.current.value='';};
    let previous=aiSession.getSnapshot()[provider];
    const unsubscribe=aiSession.subscribe(()=>{
      const next=aiSession.getSnapshot()[provider];
      if(next!==previous&&['disconnected','error'].includes(next.phase))reset();
      previous=next;
    });
    window.addEventListener('pagehide',reset);
    return()=>{reset();unsubscribe();window.removeEventListener('pagehide',reset);};
  },[provider]);
  async function submit(event) {
    event.preventDefault();const input=event.currentTarget.querySelector('input[type="password"]');
    let secret=input.value;input.value='';
    const promise=aiSession.connect(provider,secret);secret='';await promise;
  }
  return <section className="ai-provider"><h3>{title}</h3>
    <form className="ai-key-form" onSubmit={submit} autoComplete="off">
      <label className="form-label">{title} API Key<input ref={inputRef} type="password" aria-label={title+' API Key'} className="form-input" required maxLength={512} disabled={status.phase==='checking'} autoComplete="off" autoCapitalize="none" spellCheck={false} data-lpignore="true" placeholder="กรอกใหม่สำหรับแท็บนี้"/></label>
      <button className="brand-button" disabled={status.phase==='checking'}>{status.phase==='checking'?'กำลังดึงโมเดล…':'ตรวจคีย์และดึงโมเดลใหม่'}</button>
    </form>
    {status.phase==='ready'&&<p className="notice">อ่านรายการโมเดลสำเร็จ · ยังไม่ยืนยัน quota สำหรับ inference</p>}
    {status.error&&<p role="alert" className="error-message">{status.error}</p>}
    {status.phase!=='disconnected'&&<button className="text-button danger" onClick={()=>aiSession.disconnect(provider)}>ล้าง {title} API Key</button>}
  </section>;
}
export function AiSettings() {
  const session=useAiSession();
  return <div className="stack-form ai-settings">
    <p className="notice">ช่วงทดสอบ · คีย์เข้ารหัสในหน่วยความจำแท็บนี้เท่านั้น ปิดแท็บ/รีโหลดแล้วต้องกรอกใหม่ ไม่มีการบันทึกคีย์ลง Cookies, Cache หรือไฟล์โครงการ</p>
    <ProviderKey provider="openai" title="OpenAI" status={session.openai}/>
    <ProviderKey provider="openrouter" title="OpenRouter" status={session.openrouter}/>
    <div className="form-grid">{[['llm','LLM'],['ocr','OCR']].map(([kind,title])=>{
      const provider=session[kind+'Provider'],status=session[provider],field=kind+'Model';
      const models=(status?.models||[]).filter(m=>provider==='openai'||m[kind==='ocr'?'canOcr':'canDraft']);
      return <div className="stack-form" key={kind}>
        <label className="form-label">ผู้ให้บริการ {title}<select aria-label={'ผู้ให้บริการ '+title} className="form-input" value={provider} onChange={e=>aiSession.setProvider(kind,e.target.value)}>{kind==='ocr'&&<option value="local">OCR ในเครื่อง · ไม่ใช้ API Key</option>}<option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option></select></label>
        {provider==='local'?<p className="notice">อ่านข้อความไทย/อังกฤษในเบราว์เซอร์ ไม่ส่งภาพให้ AI API และถอดข้อความเองได้เสมอ</p>:status.phase==='ready'?<><label className="form-label">โมเดล {title}<select className="form-input" aria-label={'โมเดล '+title} value={status[field]} onChange={e=>aiSession.setModel(field,e.target.value,provider)}><option value="" disabled>เลือกโมเดลที่รองรับงานนี้</option>{models.map(m=><option key={m.id} value={m.id}>{m.id} — {m.label}</option>)}</select></label><small className="muted">{models.find(m=>m.id===status[field])?.description}</small></>:<p className="muted">เชื่อมคีย์ {provider==='openrouter'?'OpenRouter':'OpenAI'} สำหรับงาน {title} ก่อน</p>}
      </div>;
    })}</div>
    <p className="muted">แต่ละบริการแนะนำสูงสุด 5 รุ่นจากรายการล่าสุด OCR แสดงเฉพาะรุ่นรับภาพได้ LLM ผ่าน OpenRouter ต้องรองรับ structured output เริ่มงานง่ายและเปลี่ยนรุ่นเอง การแบ่งระดับยังไม่ใช่ benchmark TOR ภาษาไทย</p>
    <ProviderKey provider="typesafe" title="TypeSafe" status={session.typesafe}/>
    {session.typesafe.phase==='ready'&&<p className="notice">System One: {session.typesafe.model||'บัญชีนี้ไม่มี Jev stable ที่รองรับ'} · เวอร์ชันจริงแสดงในผลแต่ละงาน</p>}
    <label className="ai-consent"><input type="checkbox" checked={session.consent} onChange={event=>aiSession.setConsent(event.target.checked)}/> อนุญาตส่งเฉพาะข้อความ/ภาพที่เลือกไป OpenAI, OpenRouter และผู้ให้บริการโมเดลต้นทาง หรือ TypeSafe เพื่อทดสอบ มีค่าใช้ API ตามบัญชีของฉัน</label>
    <p className="muted">คีย์ถูกถอดรหัสชั่วคราวระหว่างส่ง HTTPS ผ่านเซิร์ฟเวอร์แอป การเข้ารหัสไม่ได้ป้องกัน XSS/ส่วนขยายอันตรายทั้งหมด นโยบายเก็บข้อมูลของผู้ให้บริการแยกจากการเก็บข้อมูลในเบราว์เซอร์</p>
    <button className="outline-button" onClick={()=>aiSession.clear()}>ล้างคีย์และการเชื่อมต่อทั้งหมด</button>
  </div>;
}
export function AiSettingsButton({onOpen}={}) {
  const [open,setOpen]=useState(false);
  return <><button className="outline-button" onClick={()=>onOpen?onOpen():setOpen(true)}>AI / API Keys</button>{open&&!onOpen&&<WorkspaceDialog title="AI สำหรับช่วงทดสอบ" onClose={()=>setOpen(false)} wide><AiSettings/></WorkspaceDialog>}</>;
}

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
    {session.openai.phase==='ready'&&<div className="form-grid">{[['llmModel','โมเดล LLM'],['ocrModel','โมเดล OCR']].map(([kind,label])=><label key={kind} className="form-label">{label}<select className="form-input" aria-label={label} value={session.openai[kind]} onChange={event=>aiSession.setModel(kind,event.target.value)}><option value="" disabled>เลือกโมเดล · ไม่มีรุ่นงานง่ายที่ใช้ได้</option>{session.openai.models.map(m=><option key={m.id} value={m.id}>{m.id} — {m.label}</option>)}</select><small className="muted">{session.openai.models.find(m=>m.id===session.openai[kind])?.description}</small></label>)}</div>}
    {session.openai.phase==='ready'&&<p className="muted">แนะนำ {session.openai.models.length}/5 รุ่นจากรายการล่าสุดของคีย์นี้ เริ่มงานง่ายเสมอ รุ่นยากเลือกเองเมื่อรุ่นง่าย/กลางทำไม่ได้ การแบ่งระดับยังไม่ใช่ผล benchmark TOR ภาษาไทย</p>}
    <ProviderKey provider="typesafe" title="TypeSafe" status={session.typesafe}/>
    {session.typesafe.phase==='ready'&&<p className="notice">System One: {session.typesafe.model||'บัญชีนี้ไม่มี Jev stable ที่รองรับ'} · เวอร์ชันจริงแสดงในผลแต่ละงาน</p>}
    <label className="ai-consent"><input type="checkbox" checked={session.consent} onChange={event=>aiSession.setConsent(event.target.checked)}/> อนุญาตส่งเฉพาะข้อความ/ภาพที่เลือกไป OpenAI หรือ TypeSafe เพื่อทดสอบ มีค่าใช้ API ตามบัญชีของฉัน</label>
    <p className="muted">คีย์ถูกถอดรหัสชั่วคราวระหว่างส่ง HTTPS ผ่านเซิร์ฟเวอร์แอป การเข้ารหัสไม่ได้ป้องกัน XSS/ส่วนขยายอันตรายทั้งหมด นโยบายเก็บข้อมูลของผู้ให้บริการแยกจากการเก็บข้อมูลในเบราว์เซอร์</p>
    <button className="outline-button" onClick={()=>aiSession.clear()}>ล้างคีย์และการเชื่อมต่อทั้งหมด</button>
  </div>;
}
export function AiSettingsButton() {
  const [open,setOpen]=useState(false);
  return <><button className="outline-button" onClick={()=>setOpen(true)}>AI / API Keys</button>{open&&<WorkspaceDialog title="AI สำหรับช่วงทดสอบ" onClose={()=>setOpen(false)} wide><AiSettings/></WorkspaceDialog>}</>;
}

'use client';
import {useEffect,useRef,useState} from 'react';

const PANELS=[['answer','คำตอบ'],['tor','ข้อ TOR'],['library','ไฟล์'],['template','แม่แบบ'],['settings','ตั้งค่า'],['ai','AI เสริม']];
export function WorkbenchDock({active,onChange,busy,renderPanel}) {
  const key=active||'answer',selected=key==='repair'?'tor':key;
  const [visited,setVisited]=useState(['answer']),[expanded,setExpanded]=useState(false);
  const tabs=useRef([]);
  useEffect(()=>setVisited(old=>old.includes(key)?old:[...old,key]),[key]);
  const mounted=[...new Set([...visited,key])];
  function navigate(event,index) {
    const next=event.key==='Home'?0:event.key==='End'?PANELS.length-1:event.key==='ArrowRight'?(index+1)%PANELS.length:event.key==='ArrowLeft'?(index+PANELS.length-1)%PANELS.length:null;
    if(next===null||busy)return;
    event.preventDefault();onChange(PANELS[next][0]==='answer'?null:PANELS[next][0]);tabs.current[next]?.focus();
  }
  return <section className={'workbench-dock'+(expanded?' dock-expanded':'')} aria-label="เครื่องมือในหน้าทำงาน">
    <div className="dock-navigation"><div className="dock-tabs" role="tablist" aria-label="เครื่องมือ Comply">{PANELS.map(([id,label],index)=><button key={id} ref={element=>{tabs.current[index]=element;}} id={'dock-tab-'+id} role="tab" aria-selected={selected===id} aria-controls={'dock-panel-'+(id==='tor'&&key==='repair'?'repair':id)} tabIndex={selected===id?0:-1} disabled={busy} onKeyDown={event=>navigate(event,index)} onClick={()=>onChange(id==='answer'?null:id)}>{label}</button>)}</div><button className="dock-size" aria-label={expanded?'ย่อพื้นที่เครื่องมือ':'ขยายพื้นที่เครื่องมือ'} aria-pressed={expanded} onClick={()=>setExpanded(old=>!old)}>{expanded?'−':'+'}</button></div>
    <div className="dock-content">{[...PANELS.map(([id])=>id),'repair'].map(id=><div key={id} id={'dock-panel-'+id} role="tabpanel" aria-labelledby={'dock-tab-'+(id==='repair'?'tor':id)} hidden={id!==key}>{mounted.includes(id)?renderPanel(id):null}</div>)}</div>
  </section>;
}

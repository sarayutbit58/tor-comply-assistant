'use client';
import {useEffect,useRef} from 'react';
export function WorkspaceDialog({title,onClose,children,wide=false}) {
  const ref=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    ref.current.showModal();
    return()=>{if(previous instanceof HTMLElement)previous.focus();};
  },[]);
  return <dialog ref={ref} className={'workspace-dialog '+(wide?'dialog-wide':'')} onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="ปิดหน้าต่าง" onClick={onClose}>×</button></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}

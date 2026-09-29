'use client';
import {useEffect,useRef,useState} from 'react';
import {getFile} from '@/lib/localFiles';
export default function PdfStage({docId,pageNumber=1,marks=[],resetToken,onBox,focusBox}) {
  const canvasRef=useRef(null),stageRef=useRef(null),scrollRef=useRef(null),dragRef=useRef(null);
  const [pdf,setPdf]=useState(null),[painter,setPainter]=useState(null),[selection,setSelection]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[zoom,setZoom]=useState(1);
  useEffect(()=>{setSelection(null);dragRef.current=null;},[resetToken,docId,pageNumber]);
  useEffect(()=>{
    let cancelled=false,opened;
    setPdf(null);setError('');setZoom(1);
    if(!docId)return;
    setBusy(true);
    (async()=>{
      const entry=await getFile(docId);if(!entry)throw new Error('ไม่พบไฟล์ในเครื่อง กรุณานำเข้าไฟล์โครงการที่มีเอกสารครบ');
      const library=await import('@/lib/pdfBrowser');opened=await library.loadPdf(entry.blob);
      if(cancelled){await opened.destroy();return;}setPdf(opened);setPainter(()=>library.paintPage);
    })().catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});
    return()=>{cancelled=true;if(opened)opened.destroy();};
  },[docId]);
  useEffect(()=>{
    if(!pdf||!painter||!canvasRef.current)return;
    let cancelled=false;setBusy(true);setError('');
    const scratch=document.createElement('canvas');
    painter(pdf,Math.max(1,Math.min(pageNumber,pdf.numPages)),scratch).then(()=>{
      if(cancelled||!canvasRef.current)return;
      const canvas=canvasRef.current;canvas.width=scratch.width;canvas.height=scratch.height;canvas.getContext('2d').drawImage(scratch,0,0);
      const target=focusBox?.[1]||0;
      requestAnimationFrame(()=>{if(scrollRef.current&&stageRef.current)scrollRef.current.scrollTop=target*stageRef.current.clientHeight-35;});
    }).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});
    return()=>{cancelled=true;};
  },[pdf,painter,pageNumber,focusBox]);
  function point(event){
    const bounds=canvasRef.current.getBoundingClientRect();
    return [Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))];
  }
  const between=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1])];
  function start(event){if(!onBox||!pdf||busy)return;event.preventDefault();dragRef.current=point(event);stageRef.current.setPointerCapture(event.pointerId);setSelection([...dragRef.current,0,0]);onBox(null);}
  function finish(event){if(!dragRef.current)return;const box=between(dragRef.current,point(event));dragRef.current=null;if(box[2]>.005&&box[3]>.005){setSelection(box);onBox(box);}else{setSelection(null);onBox(null);}}
  return <div className="pdf-viewer">
    <div className="pdf-tools"><span>{busy?'กำลังแสดง…':onBox?'ลากกรอบเพื่อผูกหลักฐาน':'TOR ต้นฉบับ'}</span><button aria-label="ย่อ PDF" onClick={()=>setZoom(z=>Math.max(.75,z-.25))} disabled={zoom<=.75}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="ขยาย PDF" onClick={()=>setZoom(z=>Math.min(3,z+.25))} disabled={zoom>=3}>+</button><button onClick={()=>setZoom(1)}>พอดีช่อง</button></div>
    {error&&<p role="alert" className="error-message">{error}</p>}
    <div ref={scrollRef} className="pdf-scroll">
      {docId?<div ref={stageRef} className={'pdf-stage '+(onBox?'selectable':'')} style={{width:zoom*100+'%'}} onPointerDown={start} onPointerMove={e=>{if(dragRef.current)setSelection(between(dragRef.current,point(e)));}} onPointerUp={finish} onPointerCancel={()=>{dragRef.current=null;setSelection(null);onBox?.(null);}}>
        <canvas ref={canvasRef}/>
        <div className="pdf-overlays">{marks.map(mark=><div key={mark.id} className={'pdf-mark '+(mark.active?'active':'')} style={{left:mark.box[0]*100+'%',top:mark.box[1]*100+'%',width:mark.box[2]*100+'%',height:mark.box[3]*100+'%'}}><span>ข้อ {mark.number}</span></div>)}
        {selection&&<div className="pdf-selection" style={{left:selection[0]*100+'%',top:selection[1]*100+'%',width:selection[2]*100+'%',height:selection[3]*100+'%'}}/>}</div>
      </div>:<div className="document-empty">ยังไม่ผูกหลักฐาน</div>}
    </div>
  </div>;
}

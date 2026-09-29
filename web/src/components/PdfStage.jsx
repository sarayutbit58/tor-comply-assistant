'use client';

import { useEffect, useRef, useState } from 'react';
import { getFile } from '@/lib/localFiles';

export default function PdfStage({ docId, pageNumber, marks, resetToken, onBox }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [paint, setPaint] = useState(null);
  const [selection, setSelection] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelection(null), [resetToken]);

  useEffect(() => {
    let cancelled = false;
    let opened;
    setPdf(null);
    setPaint(null);
    setSelection(null);
    setError('');
    if (!docId) return;
    setBusy(true);
    (async () => {
      const entry = await getFile(docId);
      if (!entry) throw new Error('ไฟล์ PDF ไม่อยู่ในเบราว์เซอร์นี้ กรุณาแนบอีกครั้ง');
      const library = await import('@/lib/pdfBrowser');
      opened = await library.loadPdf(entry.blob);
      if (cancelled) return opened.destroy();
      setPdf(opened);
      setPaint(() => library.paintPage);
    })().catch(cause => { if (!cancelled) setError(cause.message || 'เปิด PDF ไม่สำเร็จ'); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; if (opened) opened.destroy(); };
  }, [docId]);

  useEffect(() => {
    if (!pdf || !paint || !canvasRef.current) return;
    let cancelled = false;
    setSelection(null);
    setBusy(true);
    const scratch = document.createElement('canvas');
    paint(pdf, pageNumber, scratch).then(() => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = scratch.width;
      canvas.height = scratch.height;
      canvas.getContext('2d')?.drawImage(scratch, 0, 0);
    }).catch(cause => { if (!cancelled) setError(cause.message || 'แสดงหน้า PDF ไม่สำเร็จ'); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [pdf, paint, pageNumber]);

  function point(event) {
    const bounds = canvasRef.current.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))];
  }

  function boxBetween(start, end) {
    return [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.abs(start[0] - end[0]), Math.abs(start[1] - end[1])];
  }

  function pointerDown(event) {
    if (!pdf || busy) return;
    event.preventDefault();
    dragRef.current = point(event);
    stageRef.current.setPointerCapture(event.pointerId);
    setSelection([dragRef.current[0], dragRef.current[1], 0, 0]);
  }

  function pointerMove(event) {
    if (dragRef.current) setSelection(boxBetween(dragRef.current, point(event)));
  }

  function pointerUp(event) {
    if (!dragRef.current) return;
    const box = boxBetween(dragRef.current, point(event));
    dragRef.current = null;
    if (box[2] > 0.005 && box[3] > 0.005) {
      setSelection(box);
      onBox(box);
    } else setSelection(null);
  }

  return <div className="rounded-md border border-zinc-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#262629] px-4 py-3 text-xs text-white"><strong>หน้า PDF {pageNumber}</strong><span className="text-zinc-300">ลากกรอบบนภาพเพื่อเลือกหลักฐาน</span></div>
    <div className="flex min-h-80 items-start justify-center overflow-auto bg-zinc-200 p-2 sm:p-5">
      {!docId ? <p className="m-auto p-8 text-sm text-zinc-600">เพิ่มเอกสาร PDF ก่อน</p> :
        <div ref={stageRef} className="relative max-w-full touch-none select-none" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
          <canvas ref={canvasRef} className="block h-auto max-w-full bg-white shadow-lg" />
          <div className="pointer-events-none absolute inset-0">
            {marks.map(mark => <div key={mark.id} className="absolute border border-yellow-500/70 bg-yellow-200/50" style={{ left: `${mark.box[0] * 100}%`, top: `${mark.box[1] * 100}%`, width: `${mark.box[2] * 100}%`, height: `${mark.box[3] * 100}%` }}><span className="absolute bottom-full left-0 whitespace-nowrap bg-white/90 px-1 text-[10px] font-bold text-red-700">ข้อที่ {mark.number}</span></div>)}
            {selection && <div className="absolute border-2 border-[#ff0038] bg-yellow-200/50" style={{ left: `${selection[0] * 100}%`, top: `${selection[1] * 100}%`, width: `${selection[2] * 100}%`, height: `${selection[3] * 100}%` }} />}
          </div>
        </div>}
    </div>
    {busy && <p className="px-4 py-2 text-xs text-zinc-500">กำลังแสดงหน้าเอกสาร…</p>}
    {error && <p role="alert" className="px-4 py-2 text-xs text-red-700">{error}</p>}
  </div>;
}

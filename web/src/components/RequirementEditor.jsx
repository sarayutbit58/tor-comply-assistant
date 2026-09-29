'use client';

import { useState } from 'react';

export function RequirementEditor({ requirement, onSave, onDelete }) {
  const [number, setNumber] = useState(requirement.id);
  const [title, setTitle] = useState(requirement.title);
  const [text, setText] = useState(requirement.textSnapshot);
  const [page, setPage] = useState(requirement.sourcePage || '');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    setError('');
    try { onSave({ id: number.trim(), title: title.trim(), textSnapshot: text.trim(), sourcePage: page ? Number(page) : null }); }
    catch (cause) { setError(cause.message || 'บันทึกข้อ TOR ไม่สำเร็จ'); }
  }

  return <form onSubmit={submit} className="panel mt-5 space-y-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-base font-bold">ตรวจข้อ TOR</h3><button type="button" className="text-xs font-semibold text-red-700" onClick={() => { if (window.confirm(`ลบข้อ ${requirement.id}?`)) onDelete(); }}>ลบข้อนี้</button></div>
    {requirement.sourceMethod === 'ocr' && <p className="border-l-2 border-[#ff0038] bg-red-50 p-2 text-xs text-red-800">ข้อความจาก OCR ต้องเทียบกับ TOR ต้นฉบับก่อนใช้</p>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="form-label">เลขข้อ<input className="form-input" required value={number} onChange={event => setNumber(event.target.value)} /></label><label className="form-label">หน้า PDF ของ TOR<input className="form-input" type="number" min="1" value={page} onChange={event => setPage(event.target.value)} /></label></div>
    <label className="form-label">หัวข้อ<input className="form-input" value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label className="form-label">ข้อความตาม TOR<textarea className="form-input min-h-32" required value={text} onChange={event => setText(event.target.value)} /></label>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <button className="dark-button" type="submit">บันทึกข้อ TOR</button>
  </form>;
}

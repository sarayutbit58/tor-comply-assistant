'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { ComplyEditorRow } from './ComplyEditorRow';
import { RequirementEditor } from './RequirementEditor';
import { useProjectStore } from '@/store/projectStore';
import { rankDocuments, parsePages, makeSearchIndex } from '@/lib/torModel.mjs';
import { deleteFile, getFile, putFile } from '@/lib/localFiles';
import { downloadBlob } from '@/lib/download';

const PdfStage = dynamic(() => import('./PdfStage'), { ssr: false, loading: () => <div className="panel text-sm text-zinc-500">กำลังเปิดตัวดู PDF…</div> });
const tabs = [['tor', '01', 'ข้อกำหนด TOR'], ['library', '02', 'สินค้าและเอกสาร'], ['evidence', '03', 'ทำเครื่องหมายหลักฐาน'], ['table', '04', 'ตาราง Comply']];

export function ProjectClient({ projectId }) {
  const router = useRouter();
  const project = useProjectStore(state => state.projects.find(item => item.id === projectId));
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState('tor');
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [page, setPage] = useState(1);
  const [box, setBox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualPage, setManualPage] = useState('');
  const [ocrPage, setOcrPage] = useState(1);
  const [ocrDraft, setOcrDraft] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [productName, setProductName] = useState('');
  const [productModel, setProductModel] = useState('');
  const [uploadProductId, setUploadProductId] = useState('');
  const [printedPage, setPrintedPage] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const failed = () => setMessage('พื้นที่เก็บข้อมูลเบราว์เซอร์เต็มหรือถูกปิด กรุณาส่งออกงานและตรวจการตั้งค่าเบราว์เซอร์');
    window.addEventListener('tor-storage-error', failed);
    return () => window.removeEventListener('tor-storage-error', failed);
  }, []);

  const requirementId = project?.requirements.some(item => item.id === selectedReqId) ? selectedReqId : project?.requirements[0]?.id || null;
  const requirement = project?.requirements.find(item => item.id === requirementId);
  const docId = project?.docs.some(item => item.id === selectedDocId) ? selectedDocId : project?.docs[0]?.id || null;
  const document = project?.docs.find(item => item.id === docId);
  const pageNumber = Math.max(1, Math.min(page, document?.pageCount || 1));
  const evidenceByRequirement = useMemo(() => {
    const index = new Map();
    for (const item of project?.evidence || []) {
      if (!index.has(item.requirementId)) index.set(item.requirementId, []);
      index.get(item.requirementId).push(item);
    }
    return index;
  }, [project?.evidence]);
  const suggestions = useMemo(() => requirement && project ? rankDocuments(requirement.textSnapshot, project.docs) : [], [requirement, project?.docs]);
  const pageMarks = useMemo(() => (project?.evidence || []).filter(item => item.docId === docId && item.pdfPage === pageNumber).map(item => ({ ...item, number: project.requirements.find(req => req.id === item.requirementId)?.id || '' })), [project?.evidence, project?.requirements, docId, pageNumber]);
  const completed = project?.requirements.filter(item => project.rows[item.id]?.comparison === 'ตรงตามข้อกำหนด').length || 0;
  const pendingOcrPage = project?.unreadablePages.includes(ocrPage) ? ocrPage : project?.unreadablePages[0] || 1;

  const saveRow = useCallback((id, patch) => useProjectStore.getState().setRow(projectId, id, patch), [projectId]);

  async function run(task, success = '') {
    setBusy(true);
    setMessage('');
    try { await task(); if (success) setMessage(success); }
    catch (cause) { setMessage(cause.message || 'ทำรายการไม่สำเร็จ'); }
    finally { setBusy(false); }
  }

  function addManual(event) {
    event.preventDefault();
    if (!manualNumber.trim() || !manualText.trim()) return;
    if (project.requirements.some(item => item.id === manualNumber.trim())) return setMessage('เลขข้อ TOR ซ้ำ');
    useProjectStore.getState().addRequirements(projectId, [{ id: manualNumber.trim(), title: manualText.trim().slice(0, 120), textSnapshot: manualText.trim(), sourcePage: manualPage ? Number(manualPage) : null, sourceMethod: 'manual' }]);
    setSelectedReqId(manualNumber.trim());
    setManualNumber(''); setManualText(''); setManualPage('');
    setMessage('เพิ่มข้อ TOR แล้ว');
  }

  function saveRequirement(patch) {
    useProjectStore.getState().updateRequirement(projectId, requirementId, patch);
    setSelectedReqId(patch.id);
    setMessage('บันทึกข้อ TOR แล้ว');
  }

  async function originalTor() {
    await run(async () => {
      const entry = await getFile(project.torDocId);
      if (!entry) throw new Error('ไม่พบ TOR ในเบราว์เซอร์นี้');
      downloadBlob(entry.blob, project.torFilename || 'tor.pdf');
    });
  }

  async function runOcr() {
    await run(async () => {
      const entry = await getFile(project.torDocId);
      if (!entry) throw new Error('ไม่พบไฟล์ TOR สำหรับ OCR');
      const { ocrPdfPage } = await import('@/lib/pdfBrowser');
      const image = await ocrPdfPage(entry.blob, pendingOcrPage);
      const { recognizeImage } = await import('@/lib/ocrBrowser');
      const result = await recognizeImage(image);
      setOcrDraft(result.text);
      setOcrConfidence(Math.round(result.confidence));
    });
  }

  function importOcr(event) {
    event.preventDefault();
    if (!ocrDraft.trim()) return setMessage('OCR ไม่พบข้อความ กรุณาพิมพ์ตาม TOR ต้นฉบับก่อน');
    const { requirements } = parsePages([{ page: pendingOcrPage, text: ocrDraft }], 'ocr');
    const additions = requirements.filter(item => !project.requirements.some(existing => existing.id === item.id));
    if (!additions.length) return setMessage('เลขข้อจากหน้านี้ซ้ำกับข้อเดิม กรุณาตรวจและแก้ข้อความ OCR');
    useProjectStore.getState().addRequirements(projectId, additions, pendingOcrPage);
    setSelectedReqId(additions[0].id);
    setOcrDraft(''); setOcrConfidence(null);
    setMessage(`เพิ่ม ${additions.length} ข้อจาก OCR แล้ว กรุณาตรวจเทียบต้นฉบับ`);
  }

  function addProduct(event) {
    event.preventDefault();
    if (!productName.trim()) return;
    useProjectStore.getState().addProduct(projectId, productName, productModel);
    setProductName(''); setProductModel('');
    setMessage('เพิ่มสินค้า/บริการแล้ว');
  }

  async function uploadDocument(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.documentFile;
    const file = input.files?.[0];
    if (!file) return setMessage('เลือก PDF ก่อน');
    await run(async () => {
      if (!/\.pdf$/iu.test(file.name)) throw new Error('เอกสารหลักฐานต้องเป็น PDF');
      if (file.size > 40 * 1024 * 1024) throw new Error('ไฟล์ PDF เกิน 40 MB');
      const { extractPdf } = await import('@/lib/pdfBrowser');
      const pages = await extractPdf(file);
      const id = crypto.randomUUID();
      await putFile(id, file, pages.map(item => item.text));
      useProjectStore.getState().addDocument(projectId, { id, name: file.name, productId: uploadProductId || null, pageCount: pages.length, searchText: makeSearchIndex(pages.map(item => item.text).join(' ')), addedAt: new Date().toISOString() });
      setSelectedDocId(id); setPage(1); input.value = '';
    }, 'เพิ่มเอกสาร PDF แล้ว');
  }

  async function removeDocument(id) {
    if (!window.confirm('ลบเอกสารและจุดอ้างอิงที่ผูกไว้?')) return;
    await run(async () => { await deleteFile(id); useProjectStore.getState().removeDocument(projectId, id); }, 'ลบเอกสารแล้ว');
  }

  async function openDocument(id) {
    await run(async () => {
      const entry = await getFile(id);
      const meta = project.docs.find(item => item.id === id);
      if (!entry) throw new Error('ไม่พบไฟล์ในเบราว์เซอร์นี้');
      downloadBlob(entry.blob, meta?.name || 'evidence.pdf');
    });
  }

  function addEvidence(event) {
    event.preventDefault();
    if (!requirementId || !docId || !box) return setMessage('เลือกข้อ TOR เอกสาร และลากกรอบบนหน้า PDF ก่อน');
    try {
      useProjectStore.getState().addEvidence(projectId, { requirementId, docId, pdfPage: pageNumber, printedPage: printedPage.trim(), keyword: keyword.trim(), box });
      setBox(null); setPrintedPage(''); setKeyword('');
      setMessage('บันทึกไฮไลต์และเลขข้อแล้ว');
    } catch (cause) { setMessage(cause.message || 'บันทึกหลักฐานไม่สำเร็จ'); }
  }

  async function exportExcel() {
    await run(async () => {
      const { buildXlsx } = await import('@/lib/xlsx.mjs');
      downloadBlob(new Blob([buildXlsx(project)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'comply-tor.xlsx');
    });
  }

  async function exportWord() {
    await run(async () => {
      const { exportComplyWord } = await import('@/lib/exportWord');
      downloadBlob(await exportComplyWord(project), 'comply-tor.docx');
    });
  }

  async function exportPdf(id) {
    await run(async () => {
      const { exportAnnotatedPdf } = await import('@/lib/exportPdf');
      downloadBlob(await exportAnnotatedPdf(project, id), `evidence-${id}-marked.pdf`);
    });
  }

  if (!mounted) return <AppShell><p className="text-sm text-zinc-500">กำลังโหลดโครงการ…</p></AppShell>;
  if (!project) return <AppShell><p className="text-sm text-zinc-600">ไม่พบโครงการในเบราว์เซอร์นี้</p><button className="outline-button mt-3" onClick={() => router.push('/')}>กลับหน้าแรก</button></AppShell>;

  return <AppShell title={project.name}>
    <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">โครงการที่กำลังทำ</p><input aria-label="ชื่อโครงการ" className="mt-1 w-full bg-transparent text-2xl font-bold outline-none sm:text-3xl" value={project.name} onChange={event => useProjectStore.getState().rename(projectId, event.target.value)} /><p className="mt-1 text-xs text-zinc-500">{project.torFilename || 'โครงการที่ไม่แนบ TOR'}</p></div><div className="min-w-40"><strong className="text-2xl">{completed}<span className="text-base text-zinc-400">/{project.requirements.length}</span></strong><p className="text-xs text-zinc-500">ข้อที่มีผลตรงตามข้อกำหนดพร้อมหลักฐาน</p><div className="mt-2 h-1 rounded bg-zinc-200"><div className="h-1 rounded bg-[#ff0038]" style={{ width: `${project.requirements.length ? 100 * completed / project.requirements.length : 0}%` }} /></div></div></div>
    <nav className="mt-5 flex gap-1 overflow-x-auto rounded-md bg-zinc-200/70 p-1" aria-label="ขั้นตอนงาน">{tabs.map(([id, number, label]) => <button key={id} className={`step-tab ${tab === id ? 'step-tab-active' : ''}`} onClick={() => setTab(id)} type="button"><span className="mr-1 text-[10px] text-[#ff0038]">{number}</span>{label}</button>)}</nav>
    {message && <div role="status" className="mt-4 border-l-2 border-[#ff0038] bg-white px-3 py-2 text-sm">{message}</div>}

    {tab === 'tor' && <section className="mt-6 space-y-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="eyebrow">ขั้นตอน 01</p><h2 className="section-title">ตรวจข้อกำหนด TOR</h2><p className="section-copy">ข้อความที่แยกได้ต้องเทียบกับต้นฉบับก่อนใช้</p></div>{project.torDocId && <button className="outline-button" onClick={originalTor} type="button">ดาวน์โหลด TOR ต้นฉบับ</button>}</div>
      {project.unreadablePages.length > 0 && <div className="panel"><h3 className="font-bold">หน้า PDF ที่ต้อง OCR: {project.unreadablePages.join(', ')}</h3><p className="mt-1 text-xs text-zinc-600">อ่านในเบราว์เซอร์ทีละหน้า แล้วแก้ข้อความก่อนเพิ่มลงเช็กลิสต์</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="form-label">หน้า PDF<select className="form-input min-w-28" value={pendingOcrPage} onChange={event => { setOcrPage(Number(event.target.value)); setOcrDraft(''); }}>{project.unreadablePages.map(number => <option key={number} value={number}>หน้า {number}</option>)}</select></label><button className="outline-button" disabled={busy} onClick={runOcr} type="button">{busy ? 'กำลังอ่าน…' : 'อ่านหน้านี้ด้วย OCR'}</button></div>{ocrConfidence !== null && <form className="mt-4 space-y-3" onSubmit={importOcr}><label className="form-label">ข้อความ OCR ที่แก้ไขได้<textarea className="form-input min-h-36" required value={ocrDraft} onChange={event => setOcrDraft(event.target.value)} /></label><p className="text-xs text-zinc-500">OCR ประเมินความชัด {ocrConfidence}% · ต้องตรวจเทียบต้นฉบับ</p><button className="dark-button" type="submit">ตรวจแล้ว เพิ่มข้อ TOR</button></form>}</div>}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={addManual} className="panel space-y-3"><h3 className="font-bold">เพิ่มข้อกำหนดเอง</h3><div className="grid gap-2 sm:grid-cols-2"><label className="form-label">เลขข้อ<input className="form-input" required value={manualNumber} onChange={event => setManualNumber(event.target.value)} placeholder="เช่น 5.3" /></label><label className="form-label">หน้า PDF<input className="form-input" type="number" min="1" value={manualPage} onChange={event => setManualPage(event.target.value)} /></label></div><label className="form-label">รายละเอียด TOR<textarea className="form-input min-h-28" required value={manualText} onChange={event => setManualText(event.target.value)} /></label><button className="dark-button" type="submit">เพิ่มในเช็กลิสต์</button></form><div className="panel"><h3 className="mb-3 font-bold">เช็กลิสต์ข้อกำหนด ({project.requirements.length})</h3><div className="max-h-[560px] space-y-1 overflow-y-auto">{project.requirements.length ? project.requirements.map(item => <button key={item.id} className={`block w-full rounded border p-3 text-left text-xs ${item.id === requirementId ? 'border-[#ff0038] bg-red-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`} onClick={() => setSelectedReqId(item.id)} type="button"><strong className="mr-2 text-[#ff0038]">{item.id}</strong>{item.title}<small className="mt-1 block text-zinc-500">{item.sourcePage ? `TOR หน้า PDF ${item.sourcePage}` : 'เพิ่มจาก DOCX หรือกรอกเอง'}{item.sourceMethod === 'ocr' ? ' · OCR: โปรดตรวจ' : ''}</small></button>) : <p className="text-sm text-zinc-500">ยังไม่มีข้อกำหนด</p>}</div></div></div>
      {requirement && <RequirementEditor key={requirement.id} requirement={requirement} onSave={saveRequirement} onDelete={() => { useProjectStore.getState().deleteRequirement(projectId, requirement.id); setSelectedReqId(null); setMessage('ลบข้อ TOR แล้ว'); }} />}
    </section>}

    {tab === 'library' && <section className="mt-6"><p className="eyebrow">ขั้นตอน 02</p><h2 className="section-title">สินค้าและเอกสาร</h2><p className="section-copy">ผู้ใช้เลือกสินค้าจริงและเพิ่ม PDF ที่ใช้เป็นหลักฐาน</p><div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="panel"><form onSubmit={addProduct} className="space-y-3"><h3 className="font-bold">สินค้า / บริการที่เสนอ</h3><label className="form-label">ชื่อ<input className="form-input" required value={productName} onChange={event => setProductName(event.target.value)} /></label><label className="form-label">รุ่น / รายละเอียดสั้น<input className="form-input" value={productModel} onChange={event => setProductModel(event.target.value)} /></label><button className="dark-button" type="submit">เพิ่มสินค้า / บริการ</button></form><ul className="mt-5 divide-y divide-zinc-100">{project.products.map(item => <li key={item.id} className="py-2 text-sm"><strong>{item.name}</strong><span className="ml-2 text-zinc-500">{item.model}</span></li>)}</ul></div><div className="panel"><form onSubmit={uploadDocument} className="space-y-3"><h3 className="font-bold">เอกสารหลักฐาน PDF</h3><label className="form-label">ผูกกับสินค้า<select className="form-input" value={uploadProductId} onChange={event => setUploadProductId(event.target.value)}><option value="">เอกสารทั่วไปของโครงการ</option>{project.products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="form-label">ไฟล์ PDF<input className="form-input" name="documentFile" type="file" accept=".pdf" required /></label><button className="brand-button" disabled={busy} type="submit">{busy ? 'กำลังอ่าน PDF…' : 'เพิ่มเอกสารหลักฐาน'}</button></form><ul className="mt-5 divide-y divide-zinc-100">{project.docs.map(item => <li key={item.id} className="flex items-center gap-2 py-2 text-sm"><span className="min-w-0 flex-1 truncate"><strong>{item.name}</strong><small className="block text-zinc-500">{item.pageCount} หน้า PDF</small></span><button className="text-xs font-semibold text-[#ff0038]" onClick={() => openDocument(item.id)} type="button">เปิด</button><button className="text-xs font-semibold text-red-700" onClick={() => removeDocument(item.id)} type="button">ลบ</button></li>)}</ul></div></div></section>}

    {tab === 'evidence' && <section className="mt-6"><p className="eyebrow">ขั้นตอน 03</p><h2 className="section-title">ทำเครื่องหมายหลักฐาน</h2><p className="section-copy">ลากกรอบบน PDF แล้วระบุเลขหน้าที่พิมพ์ในเอกสาร</p><div className="mt-5 grid gap-5 lg:grid-cols-[340px_1fr]"><div className="panel space-y-4"><label className="form-label">ข้อ TOR<select className="form-input" value={requirementId || ''} onChange={event => { setSelectedReqId(event.target.value); setBox(null); }}>{project.requirements.length ? project.requirements.map(item => <option key={item.id} value={item.id}>ข้อ {item.id} · {item.title.slice(0, 45)}</option>) : <option value="">เพิ่มข้อ TOR ก่อน</option>}</select></label>{requirement && <p className="border-l-2 border-[#ff0038] bg-red-50 p-2 text-xs leading-6">{requirement.textSnapshot}</p>}<div><h3 className="text-xs font-bold">เอกสารที่มีคำตรงกัน</h3><p className="text-[11px] text-zinc-500">เป็นคำแนะนำ ไม่ใช่ผล Comply</p>{suggestions.length ? suggestions.slice(0, 5).map(item => <button key={item.id} className="mt-1 block w-full rounded border border-zinc-200 p-2 text-left text-xs hover:border-[#ff0038]" onClick={() => { setSelectedDocId(item.id); setPage(1); setBox(null); }} type="button">{item.name}<small className="block text-zinc-500">{item.matchedTerms.join(', ')}</small></button>) : <p className="mt-2 text-xs text-zinc-500">ยังไม่พบคำตรงกัน</p>}</div><label className="form-label">เอกสารหลักฐาน<select className="form-input" value={docId || ''} onChange={event => { setSelectedDocId(event.target.value); setPage(1); setBox(null); }}>{project.docs.length ? project.docs.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">เพิ่ม PDF ก่อน</option>}</select></label><div className="flex items-center justify-between rounded border border-zinc-200 text-xs"><button className="px-4 py-2 text-lg disabled:opacity-30" disabled={pageNumber <= 1} onClick={() => { setPage(pageNumber - 1); setBox(null); }} type="button" aria-label="หน้าก่อน">‹</button><span>หน้า PDF {pageNumber} / {document?.pageCount || 1}</span><button className="px-4 py-2 text-lg disabled:opacity-30" disabled={pageNumber >= (document?.pageCount || 1)} onClick={() => { setPage(pageNumber + 1); setBox(null); }} type="button" aria-label="หน้าถัดไป">›</button></div><form onSubmit={addEvidence} className="space-y-3"><label className="form-label">เลขหน้าที่พิมพ์ในเอกสาร<input className="form-input" value={printedPage} onChange={event => setPrintedPage(event.target.value)} placeholder="เช่น 4" /></label><label className="form-label">คำ / จุดที่ทำเครื่องหมาย<input className="form-input" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="เช่น IPv6 Addressing" /></label><p className={`rounded border p-2 text-xs ${box ? 'border-[#ff0038] text-[#ff0038]' : 'border-dashed border-zinc-300 text-zinc-500'}`}>{box ? 'เลือกตำแหน่งไฮไลต์แล้ว' : 'ยังไม่ได้ลากกรอบไฮไลต์'}</p><button className="brand-button w-full" type="submit">บันทึกไฮไลต์และเลขข้อ</button></form><div className="border-t border-zinc-200 pt-3"><h3 className="text-xs font-bold">จุดอ้างอิงของข้อนี้</h3>{(evidenceByRequirement.get(requirementId) || []).map(item => <div key={item.id} className="mt-2 flex gap-2 border-b border-zinc-100 pb-2 text-xs"><span className="flex-1">{project.docs.find(doc => doc.id === item.docId)?.name || item.docId} · หน้า {item.printedPage || `PDF ${item.pdfPage}`}</span><button className="text-red-700" onClick={() => useProjectStore.getState().removeEvidence(projectId, item.id)} type="button">ลบ</button></div>)}</div></div><PdfStage docId={docId} pageNumber={pageNumber} marks={pageMarks} resetToken={requirementId} onBox={setBox} /></div></section>}

    {tab === 'table' && <section className="mt-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">ขั้นตอน 04</p><h2 className="section-title">ตาราง Comply TOR</h2><p className="section-copy">ผู้ใช้เขียนรายละเอียดที่เสนอและยืนยันผลแต่ละข้อ</p></div><div className="flex flex-wrap gap-2"><button className="outline-button" disabled={busy || !project.requirements.length} onClick={exportWord} type="button">ดาวน์โหลด Word</button><button className="brand-button" disabled={busy || !project.requirements.length} onClick={exportExcel} type="button">ดาวน์โหลด Excel</button></div></div><div className="mt-5 overflow-hidden rounded border border-zinc-200"><div className="hidden bg-[#262629] text-xs font-bold text-white lg:grid lg:grid-cols-[1.15fr_1.1fr_.8fr_.95fr]"><span className="p-3">รายละเอียดการดำเนินงาน</span><span className="p-3">รายละเอียดที่เสนอ</span><span className="p-3">เปรียบเทียบ</span><span className="p-3">เอกสารอ้างอิง</span></div>{project.requirements.length ? project.requirements.map(item => <ComplyEditorRow key={item.id} requirement={item} row={project.rows[item.id]} products={project.products} evidence={evidenceByRequirement.get(item.id) || []} docs={project.docs} onSave={saveRow} />) : <p className="bg-white p-5 text-sm text-zinc-500">ยังไม่มีข้อ TOR สำหรับสร้างตาราง</p>}</div><div className="panel mt-5"><h3 className="font-bold">PDF หลักฐานที่ทำเครื่องหมายแล้ว</h3><p className="mt-1 text-xs text-zinc-500">สร้างสำเนาที่มีไฮไลต์สีเหลืองและเลขข้อสีแดง โดยไม่เปลี่ยนไฟล์ต้นฉบับ</p><div className="mt-3 flex flex-wrap gap-2">{project.docs.map(item => <button key={item.id} className="outline-button max-w-full truncate" disabled={busy} onClick={() => exportPdf(item.id)} type="button">↓ {item.name}</button>)}</div></div></section>}
  </AppShell>;
}

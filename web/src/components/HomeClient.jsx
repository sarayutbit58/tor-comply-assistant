'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { useProjectStore } from '@/store/projectStore';
import { parsePages } from '@/lib/torModel.mjs';
import { deleteFile, putFile } from '@/lib/localFiles';

export function HomeClient() {
  const router = useRouter();
  const projects = useProjectStore(state => state.projects);
  const createProject = useProjectStore(state => state.createProject);
  const deleteProject = useProjectStore(state => state.deleteProject);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setMounted(true), []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let torDocId = null;
      let requirements = [];
      let unreadablePages = [];
      if (file) {
        if (file.size > 40 * 1024 * 1024) throw new Error('ไฟล์ TOR เกิน 40 MB');
        if (/\.pdf$/iu.test(file.name)) {
          const { extractPdf } = await import('@/lib/pdfBrowser');
          ({ requirements, unreadablePages } = parsePages(await extractPdf(file)));
        } else if (/\.docx$/iu.test(file.name)) {
          const { extractDocx } = await import('@/lib/docxBrowser');
          ({ requirements, unreadablePages } = await extractDocx(file));
        } else throw new Error('รองรับ TOR แบบ PDF หรือ DOCX เท่านั้น');
        torDocId = crypto.randomUUID();
        await putFile(torDocId, file);
      }
      const id = createProject({ name, torDocId, torFilename: file?.name || '', requirements, unreadablePages });
      router.push(`/project/${id}`);
    } catch (cause) {
      setError(cause.message || 'สร้างโครงการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function remove(project) {
    if (!window.confirm(`ลบโครงการ ${project.name} และไฟล์ที่เก็บในเบราว์เซอร์นี้?`)) return;
    try {
      await Promise.all([project.torDocId, ...project.docs.map(doc => doc.id)].filter(Boolean).map(deleteFile));
      deleteProject(project.id);
    } catch (cause) {
      setError(cause.message || 'ลบโครงการไม่สำเร็จ');
    }
  }

  return <AppShell>
    <section className="grid gap-8 py-7 lg:grid-cols-[1fr_420px] lg:items-center lg:py-16">
      <div>
        <p className="eyebrow">Presales workspace / TOR Comply</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">จากข้อกำหนด<br/><span className="text-[#ff0038]">สู่หลักฐานที่ตรวจสอบได้</span></h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-600">อ่าน TOR เป็นเช็กลิสต์ ผูกสินค้าและเอกสาร ทำเครื่องหมายบน PDF แล้วส่งออกตาราง Comply โดยไม่เรียก AI API แบบเสียเงิน</p>
        <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="flow-chip">TOR</span><b className="text-[#ff0038]">→</b><span className="flow-chip">สินค้า</span><b className="text-[#ff0038]">→</b><span className="flow-chip">หลักฐาน</span><b className="text-[#ff0038]">→</b><span className="flow-chip">ตาราง</span></div>
      </div>
      <form onSubmit={create} className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="eyebrow">01 / โครงการใหม่</p>
        <h2 className="mb-5 mt-2 text-2xl font-bold">เริ่มจาก TOR</h2>
        <label className="form-label">ชื่อโครงการ<input className="form-input" value={name} onChange={event => setName(event.target.value)} maxLength={160} required placeholder="เช่น โครงการจัดหาเครือข่ายสำนักงาน" /></label>
        <label className="form-label mt-4">ไฟล์ TOR (PDF หรือ DOCX)<input className="form-input" type="file" accept=".pdf,.docx" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
        <p className="mt-3 text-xs leading-5 text-zinc-500">PDF สแกนจะถูกระบุหน้าที่ต้อง OCR และให้ตรวจข้อความทีละหน้า</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <button className="brand-button mt-6 w-full" disabled={busy} type="submit">{busy ? 'กำลังอ่าน TOR…' : 'สร้างโครงการและอ่าน TOR'}</button>
      </form>
    </section>
    <section className="border-t border-zinc-200 pt-7">
      <h2 className="text-base font-bold">โครงการล่าสุด</h2>
      {!mounted ? <p className="mt-3 text-sm text-zinc-500">กำลังโหลดโครงการ…</p> : projects.length === 0 ? <p className="mt-3 text-sm text-zinc-500">ยังไม่มีโครงการ</p> :
        <ul className="mt-4 grid gap-2">{projects.map(project => <li key={project.id} className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-4">
          <button className="min-w-0 flex-1 text-left" onClick={() => router.push(`/project/${project.id}`)}><strong className="block truncate text-sm">{project.name}</strong><span className="mt-1 block text-xs text-zinc-500">{project.requirements.length} ข้อ TOR · {project.docs.length} เอกสาร</span></button>
          <button className="text-xs font-semibold text-red-700" onClick={() => remove(project)} type="button">ลบ</button>
        </li>)}</ul>}
    </section>
    <p className="mt-8 text-xs text-zinc-500">ข้อมูลและไฟล์อยู่ในเบราว์เซอร์ของอุปกรณ์นี้ ไม่ซิงก์ข้ามเครื่องและไม่ส่งเอกสารไปยังเซิร์ฟเวอร์</p>
  </AppShell>;
}

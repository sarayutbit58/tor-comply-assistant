'use client';

import { memo, useEffect, useState } from 'react';

export const ComplyEditorRow = memo(function ComplyEditorRow({ requirement, row, products, evidence, docs, onSave }) {
  const [proposal, setProposal] = useState(row?.proposal || '');
  const [comparison, setComparison] = useState(row?.comparison || 'รอตรวจสอบ');
  const [productId, setProductId] = useState(row?.productId || '');
  const [error, setError] = useState('');
  useEffect(() => {
    setProposal(row?.proposal || '');
    setComparison(row?.comparison || 'รอตรวจสอบ');
    setProductId(row?.productId || '');
  }, [row?.proposal, row?.comparison, row?.productId]);

  function save(event) {
    event.preventDefault();
    setError('');
    try { onSave(requirement.id, { proposal, comparison, productId: productId || null }); }
    catch (cause) { setError(cause.message || 'บันทึกผลไม่สำเร็จ'); }
  }

  return <form onSubmit={save} className="grid gap-0 border-b border-zinc-200 bg-white last:border-b-0 lg:grid-cols-[1.15fr_1.1fr_.8fr_.95fr]">
    <div className="table-cell"><span className="table-label">รายละเอียดการดำเนินงาน</span><strong className="mb-1 block text-[#ff0038]">ข้อ {requirement.id}</strong><span className="whitespace-pre-wrap">{requirement.textSnapshot}</span></div>
    <div className="table-cell"><label className="table-label" htmlFor={`proposal-${requirement.id}`}>รายละเอียดที่ผู้เสนอราคาเสนอ</label><textarea id={`proposal-${requirement.id}`} className="form-input min-h-24" value={proposal} onChange={event => setProposal(event.target.value)} placeholder="ระบุรายละเอียดที่เสนอ" /></div>
    <div className="table-cell"><label className="table-label" htmlFor={`comparison-${requirement.id}`}>ผลเปรียบเทียบ</label><select id={`comparison-${requirement.id}`} className="form-input" value={comparison} onChange={event => setComparison(event.target.value)}><option>รอตรวจสอบ</option><option>ตรงตามข้อกำหนด</option><option>ไม่ตรงตามข้อกำหนด</option></select><select className="form-input mt-2" aria-label={`สินค้า/บริการของข้อ ${requirement.id}`} value={productId} onChange={event => setProductId(event.target.value)}><option value="">ไม่ระบุสินค้า</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}{product.model ? ` · ${product.model}` : ''}</option>)}</select><button type="submit" className="dark-button mt-2">บันทึกข้อนี้</button>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>
    <div className="table-cell"><span className="table-label">เอกสารอ้างอิง</span>{evidence.length ? evidence.map(item => {
      const document = docs.find(doc => doc.id === item.docId);
      return <p key={item.id} className="mb-2 break-words">{document?.name || item.docId}<small className="block text-zinc-500">หน้า {item.printedPage || `PDF ${item.pdfPage}`}{item.printedPage ? ` (PDF ${item.pdfPage})` : ''}</small></p>;
    }) : <span className="text-zinc-400">ยังไม่มีหลักฐาน</span>}</div>
  </form>;
});

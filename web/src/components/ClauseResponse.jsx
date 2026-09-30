'use client';
import {useEffect,useMemo,useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {rankItems} from '@/lib/evidenceSearch.mjs';
import {STATUS,passProblems,rowMode} from '@/lib/projectModel.mjs';
import {AiClauseAssist} from './AiClauseAssist';
export function ClauseResponse({project,requirement,run,busy,onAssess}) {
  const row=project.rows[requirement.id];
  const [proposal,setProposal]=useState(row.proposal||'');
  useEffect(()=>setProposal(row.proposal||''),[row.proposal]);
  const ranked=useMemo(()=>rankItems(project,requirement.textSnapshot),[project.products,project.docs,requirement.textSnapshot]);
  const save=patch=>{try{useProjectStore.getState().setRow(project.id,requirement.id,patch);return true;}catch(error){run(async()=>{throw error;});return false;}};
  const problems=passProblems({...project,rows:{...project.rows,[requirement.id]:{...row,proposal}}},requirement.id);
  return <div className="response-editor">
    <div className="pane-subheading"><strong>คำตอบข้อ {requirement.id}</strong><select aria-label="โหมดข้อ TOR" value={row.mode||''} onChange={e=>save({mode:e.target.value||null})}><option value="">ตามโครงการ ({project.mode==='auto'?'Auto':'ตรวจเอง'})</option><option value="manual">ตรวจยืนยันเอง</option><option value="auto">Auto ตามกฎ</option></select></div>
    <label className="muted"><input type="checkbox" checked={row.scope==='bidder'} onChange={e=>save({scope:e.target.checked?'bidder':'offering',itemIds:[]})}/> ข้อนี้เป็นคุณสมบัติผู้ยื่นข้อเสนอ</label>
    {row.scope!=='bidder'&&<details open><summary>สินค้า / บริการที่ใช้ร่วมกัน <b>{row.itemIds.length}</b></summary><div className="item-choices">{ranked.map(item=><label key={item.id}><input type="checkbox" disabled={busy} checked={row.itemIds.includes(item.id)} onChange={e=>save({itemIds:e.target.checked?[...row.itemIds,item.id]:row.itemIds.filter(id=>id!==item.id)})}/><span><strong>{item.name}</strong><small>{item.kind==='service'?'บริการ':'สินค้า'} · {[item.brand,item.model,item.provider].filter(Boolean).join(' ')} · {item.documentCount} เอกสาร</small></span>{item.score>0&&<span className="match-score">{item.matchedChecks}/{item.totalChecks} เงื่อนไข</span>}</label>)}{!ranked.length&&<p className="muted">เพิ่มสินค้า/บริการและจัดไฟล์ก่อนเลือก</p>}</div></details>}
    <label className="form-label">รายละเอียดที่เสนอ<textarea aria-label="รายละเอียดที่เสนอ" className="form-input" rows="3" value={proposal} onChange={e=>setProposal(e.target.value)} onBlur={()=>{if(proposal!==row.proposal)save({proposal});}}/></label>
    <div className="response-actions"><button className="outline-button" disabled={busy||!requirement.reviewed||(!row.itemIds.length&&row.scope!=='bidder')} onClick={()=>{if(proposal!==row.proposal&&!save({proposal}))return;onAssess(requirement.id);}}>ค้นหลักฐานและ{rowMode(project,requirement.id)==='auto'?'ประเมิน Auto':'เสนอผล'}</button><button className="brand-button" disabled={busy||problems.length>0} title={problems.join(' · ')} onClick={()=>save({proposal,comparison:STATUS.pass})}>ยืนยัน Comply</button><button className="text-button danger" disabled={busy} onClick={()=>save({proposal,comparison:STATUS.fail})}>ไม่ Comply</button><button className="text-button" onClick={()=>save({comparison:STATUS.pending})}>รอตรวจ</button></div>
    {!!problems.length&&<p className="muted">{problems.join(' · ')}</p>}
    <AiClauseAssist project={project} requirement={requirement} run={run} busy={busy}/>
    {row.assessment&&<details className="rule-results" open><summary>ผลจากกฎ · {STATUS[row.assessment.status]}</summary>{row.assessment.checks.map((c,i)=><div key={i}><span className={'check-dot '+c.outcome}/><strong>{c.label}</strong><small>{c.reason}</small></div>)}</details>}
  </div>;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {extractComplyRequirements,pdfTableRows,isComplyTable,pdfGridHeader} from '../src/lib/complyIntake.mjs';
const table=(rows,headers=['เลขข้อ','รายละเอียดตาม TOR','รายละเอียดที่เสนอ','ผล','อ้างอิง'])=>({id:'docx:0',format:'docx',tableIndex:0,headers,headerRow:0,rows:rows.map((cells,i)=>({cells,row:i+2,page:null}))});
test('filled or empty answer columns yield identical requirements and no old answers',()=>{
  const filled=table([['5.1','รองรับ IPv6','OLD_PROPOSAL','Comply','old.pdf'],['5.2','มี 24 พอร์ต','','','']]);
  const result=extractComplyRequirements([filled],{numberColumn:0,textColumn:1});
  assert.deepEqual(result.requirements.map(r=>r.id),['5.1','5.2']);
  assert.equal(result.requirements[0].textSnapshot,'รองรับ IPv6');
  assert.ok(!JSON.stringify(result).includes('OLD_PROPOSAL'));
});
test('column order is explicitly mapped and Thai numbers retain their identity',()=>{
  const t=table([['OLD','๕.๓','รองรับ MPLS','ผ่าน','']],['รายละเอียดที่เสนอ','เลขข้อ','รายละเอียดตาม TOR','ผล','อ้างอิง']);
  const result=extractComplyRequirements([t],{numberColumn:1,textColumn:2});
  assert.equal(result.requirements[0].id,'5.3');
  assert.equal(result.requirements[0].reviewed,false);
});
test('inline clause numbers and continuations retain physical PDF pages',()=>{
  const t={...table([]),id:'pdf',format:'pdf',rows:[{cells:['5.1 รองรับ IPv6','OLD'],page:1,row:1},{cells:['และ MPLS','OLD2'],page:2,row:1},{cells:['5.2 จำนวน 24 พอร์ต','OLD3'],page:2,row:2}]};
  const result=extractComplyRequirements([t],{numberColumn:null,textColumn:0});
  assert.equal(result.requirements[0].sourcePage,1);
  assert.match(result.requirements[0].textSnapshot,/MPLS/);
  assert.equal(result.requirements[1].sourcePage,2);
});
test('repeat headers are ignored and duplicate clause numbers remain separate',()=>{
  const t=table([['5.1','ข้อแรก','','',''],['เลขข้อ','รายละเอียดตาม TOR','รายละเอียดที่เสนอ','ผล','อ้างอิง'],['5.1','ข้อสอง','','','']]);
  const result=extractComplyRequirements([t],{numberColumn:0,textColumn:1});
  assert.deepEqual(result.requirements.map(r=>r.id),['5.1','5.1#2']);
  assert.equal(result.requirements[1].duplicateOf,'5.1');
});
test('PDF geometry reads only selected cells and carries wrapped text inside one row',()=>{
  const page={page:2,items:[{text:'5.1',box:[.04,.2,.04,.015]},{text:'รองรับ IPv6',box:[.15,.2,.2,.015]},{text:'และ MPLS',box:[.15,.23,.18,.015]},{text:'OLD_PROPOSAL',box:[.55,.2,.2,.015]}]};
  const rows=pdfTableRows([page],{edges:[.02,.12,.5,.9],headerBottom:.15,bottom:.9,rowEdges:{2:[.18,.28]}});
  assert.equal(rows.length,1);
  assert.equal(rows[0].cells[1],'รองรับ IPv6\nและ MPLS');
  assert.equal(rows[0].cells[2],'OLD_PROPOSAL');
});
test('a PDF text item crossing a selected column is flagged instead of silently mixed',()=>{
  const rows=pdfTableRows([{page:1,items:[{text:'TOR OLD',box:[.2,.2,.6,.02]}]}],{edges:[.1,.5,.9],headerBottom:.1,bottom:.9});
  assert.ok(rows[0].ambiguousColumns.includes(0));
  assert.throws(()=>extractComplyRequirements([{...table([]),format:'pdf',rows}],{numberColumn:null,textColumn:0}),/คร่อมคอลัมน์/);
});
test('selecting a known old-answer column is rejected',()=>{
  assert.throws(()=>extractComplyRequirements([table([['5.1','TOR','5.9 OLD','','']])],{numberColumn:0,textColumn:2}),/คำตอบหรือผลเดิม/);
});
test('two compatible DOCX tables preserve their origin for native export',()=>{
  const first=table([['5.1','IPv6','','','']]);
  const second={...table([['5.2','MPLS','','','']]),id:'docx:1',tableIndex:1};
  const result=extractComplyRequirements([first,second],{numberColumn:0,textColumn:1});
  assert.deepEqual(result.requirements.map(r=>r.sourceTableIndex),[0,1]);
});
test('unselected short-header comply tables are recognized for removal from native output',()=>{
  const t=table([['5.9','Support IPv6','OLD_PASS']],['ข้อ','TOR','เสนอ','ผล','อ้างอิง']);
  assert.equal(isComplyTable(t),true);
  assert.equal(isComplyTable({headers:['Company','Address'],rows:[{cells:['1234567890123','QA Address']}]}),false);
});
test('a narrow number column stays separate and first-row old proposal never becomes a header',()=>{
  const edges=[.03,.1,.46,.69,.8,.96],grid={edges,rows:[.1,.16,.26,.36]};
  const page={page:1,items:[
    {text:'No.',box:[.04,.12,.025,.016]},{text:'TOR Requirement',box:[.11,.12,.18,.016]},
    {text:'Proposed Specification',box:[.47,.12,.17,.016]},{text:'Comparison',box:[.70,.12,.08,.016]},{text:'Reference',box:[.81,.12,.09,.016]},
    {text:'5.1',box:[.04,.18,.025,.016]},{text:'Support IPv6',box:[.11,.18,.18,.016]},{text:'OLD_PROPOSAL',box:[.47,.18,.17,.016]},
  ]};
  const header=pdfGridHeader(page,grid);
  assert.equal(header.headers.length,5);assert.equal(header.headers[0],'No.');assert.ok(!header.headers.join(' ').includes('OLD'));
  const rows=pdfTableRows([page],{edges,headerBottom:header.bottom,bottom:.36,rowEdges:{1:grid.rows.slice(1)}});
  const result=extractComplyRequirements([{id:'pdf:0',format:'pdf',headers:header.headers,rows}],{numberColumn:0,textColumn:1});
  assert.deepEqual(result.requirements.map(r=>r.id),['5.1']);
});

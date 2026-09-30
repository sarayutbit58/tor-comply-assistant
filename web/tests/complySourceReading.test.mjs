import test from 'node:test';
import assert from 'node:assert/strict';
import {extractComplyRequirements,pdfTableRows} from '../src/lib/complyIntake.mjs';
const sourceModule=await import('../src/lib/xlsxSourceRows.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const prepare=(...args)=>{assert.equal(typeof sourceModule.prepareXlsxSourceRows,'function');return sourceModule.prepareXlsxSourceRows(...args);};
const sheet=rows=>({id:'xlsx:0',format:'xlsx',headers:['','', 'เลขข้อ','รายละเอียดตาม TOR','รายละเอียดที่เสนอ'],rows});
const item=(text,x,y,w=.05,h=.015)=>({text,box:[x,y,w,h]});

test('PDF selected-cell reconstruction repairs shuffled Thai/technical glyph runs without importing old answers',()=>{
  const page={page:1,items:[item('OLD_PROPOSAL',.6,.2,.2),item('24',.27,.2,.04),item('่า',.23,.2,.02),item('5.1',.04,.2,.03),item('ไม่น้อยกว',.15,.2,.08),item('พอร์ต',.32,.2,.06),item('IPv',.40,.2,.045),item('6',.445,.2,.015)]};
  const rows=pdfTableRows([page],{edges:[.02,.12,.5,.9],headerBottom:.1,bottom:.9,rowEdges:{1:[.18,.3]}});
  assert.equal(rows[0].cells[1],'ไม่น้อยกว่า 24 พอร์ต IPv6');
  const result=extractComplyRequirements([{id:'pdf:0',format:'pdf',headers:['เลขข้อ','รายละเอียดตาม TOR','รายละเอียดที่เสนอ'],rows}],{numberColumn:0,textColumn:1});
  const req=result.requirements[0];assert.equal(req.id,'5.1');assert.equal(req.textSnapshot,'ไม่น้อยกว่า 24 พอร์ต IPv6');
  assert.deepEqual(req.sourcePages,[1]);assert.equal(req.sourceRegions[0].page,1);assert.ok(req.sourceRegions[0].box[0]>=.12);
  assert.notEqual(req.rawTextSnapshot,req.textSnapshot);assert.ok(!JSON.stringify(req).includes('OLD_PROPOSAL'));
});
test('PDF continuation accumulates source pages and selected TOR regions only',()=>{
  const layout={edges:[.02,.12,.5,.9],headerBottom:.1,bottom:.9,rowEdges:{1:[.18,.3],2:[.18,.3,.45]}};
  const pages=[{page:1,items:[item('5.1',.04,.2,.03),item('Support IPv6',.15,.2,.2),item('OLD1',.6,.2,.1)]},{page:2,items:[item('and MPLS',.15,.2,.2),item('5.2',.04,.35,.03),item('At least 24 ports',.15,.35,.3),item('OLD2',.6,.35,.1)]}];
  const result=extractComplyRequirements([{id:'pdf:0',format:'pdf',headers:['No.','TOR','Proposed'],rows:pdfTableRows(pages,layout)}],{numberColumn:0,textColumn:1});
  assert.deepEqual(result.requirements[0].sourcePages,[1,2]);assert.deepEqual(result.requirements[0].sourceRegions.map(region=>region.page),[1,2]);
  assert.equal(result.requirements[0].sourcePage,1);assert.equal(result.requirements[0].rawTextSnapshot,'Support IPv6\nand MPLS');
  assert.ok(!JSON.stringify(result.requirements).includes('OLD'));
});
test('PDF cells with glyphs sharing a baseline stay one row even when their top positions differ',()=>{
  const rows=pdfTableRows([{page:1,items:[item('5.1',.04,.2,.03),item('รองรับ',.15,.2,.07),item('่',.22,.19,.01,.025),item('IPv6',.23,.2,.1)]}],{edges:[.02,.12,.5],headerBottom:.1,bottom:.9});
  assert.equal(rows.length,1);assert.equal(rows[0].cells[1],'รองรับ่IPv6');
});
test('sparse XLSX rows retain physical columns/rows and a vertically merged number creates one clause',()=>{
  const input=[{row:10,cells:['','','5.1','Support IPv6','OLD_A']},{row:11,cells:['','','','and MPLS','OLD_B']}];
  const prepared=prepare(input,['C10:C11']), result=extractComplyRequirements([sheet(prepared.rows)],{numberColumn:2,textColumn:3});
  assert.equal(prepared.rows[0].row,10);assert.equal(prepared.rows[1].cells[2],'');
  assert.equal(result.requirements.length,1);assert.equal(result.requirements[0].textSnapshot,'Support IPv6\nand MPLS');
  assert.equal(result.requirements[0].sourceRow,10);assert.deepEqual(result.requirements[0].sourcePages,[]);
  assert.ok(!JSON.stringify(result.requirements).includes('OLD_'));
});
test('merged number and merged TOR follower cells are not expanded into duplicate clauses',()=>{
  const prepared=prepare([{row:10,cells:['','','5.1','Support IPv6','OLD']},{row:11,cells:['','','','','OLD2']}],['C10:C11','D10:D11']);
  const result=extractComplyRequirements([sheet(prepared.rows)],{numberColumn:2,textColumn:3});
  assert.equal(result.requirements.length,1);assert.equal(result.requirements[0].textSnapshot,'Support IPv6');
});
test('a new number beside a merged TOR follower is surfaced as unresolved instead of copying the first clause text',()=>{
  const prepared=prepare([{row:10,cells:['','','5.1','Support IPv6','']},{row:11,cells:['','','5.2','','']}],['D10:D11']);
  const result=extractComplyRequirements([sheet(prepared.rows)],{numberColumn:2,textColumn:3});
  assert.deepEqual(result.requirements.map(req=>req.id),['5.1']);
  assert.ok(result.warnings.some(message=>message.includes('5.2')));assert.equal(result.unresolvedRows[0].row,11);
});
test('horizontal XLSX merging across selected source/answer columns blocks unsafe extraction',()=>{
  const prepared=prepare([{row:10,cells:['','','5.1','TOR AND OLD','']}],['D10:E10']);
  assert.ok(prepared.rows[0].ambiguousColumns.includes(3));
  assert.throws(()=>extractComplyRequirements([sheet(prepared.rows)],{numberColumn:2,textColumn:3}),/รวมเซลล์|คร่อม/);
});
test('a conflicting value inside a merged number region is warned and cannot become a second confirmed clause',()=>{
  const prepared=prepare([{row:10,cells:['','','5.1','Support IPv6','']},{row:11,cells:['','','5.2','Support MPLS','']}],['C10:C11']);
  assert.ok(prepared.warnings.length);assert.ok(prepared.rows[1].ambiguousColumns.includes(2));
});
test('omitted XLSX sheets are named in warnings without reading or borrowing their answers',()=>{
  const prepared=prepare([{row:10,cells:['','','5.1','Support IPv6','']}],[],{sheetNames:['Comply','Other TOR','Old answers']});
  assert.ok(prepared.warnings.some(message=>message.includes('Other TOR')&&message.includes('Old answers')));
});
test('an explicit clause number with empty TOR text is reported even without merging',()=>{
  const result=extractComplyRequirements([sheet([{row:10,cells:['','','5.1','Support IPv6','']},{row:11,cells:['','','5.2','','OLD']}])],{numberColumn:2,textColumn:3});
  assert.ok(result.warnings.some(message=>message.includes('5.2')));assert.equal(result.unresolvedRows[0].row,11);
});
test('merge references and processing size are bounded without mutating the input sheet',()=>{
  const rows=[{row:10,cells:['','','5.1','Support IPv6','']}], before=structuredClone(rows);
  prepare(rows,['C10:C11']);assert.deepEqual(rows,before);
  assert.throws(()=>prepare(rows,['A:Z']),/รวมเซลล์/);
  assert.throws(()=>prepare(rows,['C10:C999999999']),/รวมเซลล์/);
  assert.throws(()=>prepare(rows,Array(10001).fill('C10:C11')),/จำนวน|ขนาด/);
});

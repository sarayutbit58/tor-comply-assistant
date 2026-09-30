import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePages} from '../src/lib/torModel.mjs';
import {textInBox} from '../src/lib/evidenceSearch.mjs';
const reading=await import('../src/lib/readingModel.mjs').catch(()=>null);
const requireReading=()=>assert.ok(reading,'reading integrity helpers are not implemented');
test('visual reading follows page positions rather than PDF stream order',()=>{
 requireReading();
 const items=[{text:'48 ports',box:[.1,.4,.2,.02]},{text:'Support IPv6',box:[.1,.2,.3,.02]}];
 assert.equal(reading.reconstructReading(items).text,'Support IPv6\n48 ports');
 assert.equal(reading.reconstructReading(items).rawText,'48 ports Support IPv6');
});
test('touching technical runs and Thai marks join without corrupting units or polarity',()=>{
 requireReading();
 const items=[{text:'10',box:[.1,.2,.02,.02]},{text:'Gbps',box:[.12,.2,.04,.02]},{text:'ไม่',box:[.2,.2,.02,.02]},{text:'น้อยกว่า',box:[.22,.2,.07,.02]},{text:'24',box:[.3,.2,.02,.02]},{text:'พอร์ต',box:[.33,.2,.05,.02]}];
 const result=reading.reconstructReading(items);
 assert.match(result.text,/10Gbps/);assert.match(result.text,/ไม่น้อยกว่า/);assert.match(result.text,/24 พอร์ต/);
});
test('comparison detects missing negation, changed number and bit-byte units',()=>{
 requireReading();
 assert.equal(reading.compareReadings('ไม่น้อยกว่า 24 พอร์ต','24 พอร์ต').criticalChanged,true);
 assert.equal(reading.compareReadings('รองรับ 10 Gbps','รองรับ 10 GBps').criticalChanged,true);
 assert.equal(reading.compareReadings('24 ports','48 ports').criticalChanged,true);
 assert.equal(reading.compareReadings('๔๘ ports','48 ports').criticalChanged,false);
 assert.equal(reading.compareReadings('Support IPv6','Support   IPv6').criticalChanged,false);
});
test('risk detection exposes broken Thai glyphs and values without claiming to prove omitted words',()=>{
 requireReading();
 const risks=reading.readingRisks('ไม่น้อยกว่า 24 พอร์ต \uFFFD');
 assert.ok(risks.some(r=>r.code==='critical-values'));
 assert.ok(risks.some(r=>r.code==='broken-glyphs'));
 assert.ok(reading.readingRisks('Support IPv6 5.2 At least 24 ports').some(r=>r.code==='inline-clause'));
});
test('selected-box extraction respects visual order and excludes adjacent columns',()=>{
 requireReading();
 const page={items:[{text:'wrong proposal',box:[.7,.2,.2,.02]},{text:'48 ports',box:[.1,.4,.2,.02]},{text:'Support IPv6',box:[.1,.2,.3,.02]}]};
 assert.equal(reading.readingInBox(page,[.05,.1,.4,.5]),'Support IPv6\n48 ports');
});
test('actual clause parsing reconstructs missing EOLs and retains first and continuation source pages',()=>{
 const page={page:1,text:'5.1 Support IPv6 5.2 At least 24 ports',items:[{text:'5.2 At least 24 ports',box:[.1,.4,.6,.02]},{text:'5.1 Support IPv6',box:[.1,.2,.5,.02]}]};
 const result=parsePages([page,{page:2,text:'and MPLS',items:[{text:'and MPLS',box:[.1,.2,.5,.02]}]}]);
 assert.deepEqual(result.requirements.map(r=>r.id),['5.1','5.2']);
 assert.deepEqual(result.requirements[1].sourcePages,[1,2]);
 assert.equal(result.requirements[1].sourcePage,1);
 assert.equal(textInBox(page,[.05,.1,.7,.5]),'5.1 Support IPv6\n5.2 At least 24 ports');
});

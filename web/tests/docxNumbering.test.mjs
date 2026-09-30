import test from 'node:test';
import assert from 'node:assert/strict';
import {allowDocxEntry} from '../src/lib/docxLimits.mjs';
import {parseDocxBlocks} from '../src/lib/torModel.mjs';
const module = await import('../src/lib/docxNumbering.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const run=(paragraphs,model)=>{assert.equal(typeof module.applyDocxNumbering,'function');return module.applyDocxNumbering(paragraphs,model);};
const level=(value,pattern,start=1,extra={})=>({level:value,format:'decimal',pattern,start,...extra});
const model=levels=>({abstracts:[{id:'a',levels}],instances:[{id:'1',abstractId:'a',overrides:[]}]});
const paragraph=(text,numId='1',depth=0)=>({text,numId,level:depth});

test('bounded ZIP filter includes numbering.xml but ignores unrelated Office entries',()=>{
  assert.equal(allowDocxEntry({name:'word/numbering.xml',originalSize:300}),true);
  assert.equal(allowDocxEntry({name:'word/styles.xml',originalSize:90000000}),false);
  assert.throws(()=>allowDocxEntry({name:'word/numbering.xml',originalSize:2000000}),/ใหญ่เกินไป/);
});
test('decimal numbering reconstructs independent clauses rather than one unnumbered paragraph',()=>{
  const result=run([paragraph('Support IPv6'),paragraph('At least 24 ports')],model([level(0,'%1.')]));
  assert.deepEqual(result.paragraphs.map(p=>p.text),['1. Support IPv6','2. At least 24 ports']);
  assert.deepEqual(parseDocxBlocks(result.paragraphs.map(p=>({type:'paragraph',text:p.text}))).requirements.map(r=>r.id),['1','2']);
  assert.deepEqual(result.warnings,[]);
});
test('multilevel decimals increment and reset subordinate levels when their parent changes',()=>{
  const input=[paragraph('Network'),paragraph('Support IPv6','1',1),paragraph('Support MPLS','1',1),paragraph('Server'),paragraph('CPU','1',1)];
  const result=run(input,model([level(0,'%1.'),level(1,'%1.%2')]));
  assert.deepEqual(result.paragraphs.map(p=>p.label),['1.','1.1','1.2','2.','2.1']);
});
test('separate numbering instances keep separate counters and honor start overrides',()=>{
  const definitions=model([level(0,'%1.',3)]);definitions.instances.push({id:'2',abstractId:'a',overrides:[{level:0,start:7}]});
  const result=run([paragraph('A'),paragraph('B','2'),paragraph('C'),paragraph('D','2')],definitions);
  assert.deepEqual(result.paragraphs.map(p=>p.label),['3.','7.','4.','8.']);
});
test('an explicit clause number is preserved without a second prefix while its list counter advances',()=>{
  const result=run([paragraph('5.1 Support IPv6'),paragraph('ข้อ ๕.๒ รองรับ MPLS'),paragraph('24 ports minimum')],model([level(0,'%1.')]));
  assert.deepEqual(result.paragraphs.map(p=>p.text),['5.1 Support IPv6','ข้อ ๕.๒ รองรับ MPLS','3. 24 ports minimum']);
});
test('bare automatic decimal patterns become explicit clause markers without changing the numeric label',()=>{
  const result=run([paragraph('Short TOR')],model([level(0,'%1')]));
  assert.equal(result.paragraphs[0].text,'ข้อ 1 Short TOR');
  assert.equal(parseDocxBlocks([{type:'paragraph',text:result.paragraphs[0].text}]).requirements[0].id,'1');
});
test('empty numbered paragraphs still retain their visible number for a table number cell',()=>{
  const result=run([paragraph('')],model([level(0,'%1.')]));assert.equal(result.paragraphs[0].text,'1.');
});
test('numId zero and ordinary unnumbered text never receive an inferred prefix',()=>{
  const result=run([paragraph('plain','0'),{text:'plain 2'}],model([level(0,'%1.')]));
  assert.deepEqual(result.paragraphs.map(p=>p.text),['plain','plain 2']);assert.deepEqual(result.warnings,[]);
});
test('unsupported bullet, roman and decorative patterns keep source text and emit actionable warnings',()=>{
  for(const definition of [level(0,'•',1,{format:'bullet'}),level(0,'%1.',1,{format:'upperRoman'}),level(0,'Section %1')]){
    const result=run([paragraph('Actual text')],model([definition]));
    assert.equal(result.paragraphs[0].text,'Actual text');assert.equal(result.warnings.length,1);
    assert.match(result.warnings[0],/เลขข้อ|ลำดับ/);
  }
});
test('missing numbering definitions and style-linked definitions are surfaced without guessed numbers',()=>{
  const result=run([paragraph('Missing','7')],model([level(0,'%1.')]));
  assert.equal(result.paragraphs[0].text,'Missing');assert.equal(result.warnings.length,1);
  const linked=model([level(0,'%1.')]);linked.abstracts[0].styleLinked=true;
  assert.equal(run([paragraph('Style')],linked).warnings.length,1);
});
test('explicit never-restart rules preserve a subordinate counter across parent increments',()=>{
  const result=run([paragraph('A'),paragraph('child A','1',1),paragraph('B'),paragraph('child B','1',1)],model([level(0,'%1.'),level(1,'%1.%2',1,{restart:0})]));
  assert.deepEqual(result.paragraphs.map(p=>p.label),['1.','1.1','2.','2.2']);
});
test('a level override changes only its instance and can replace the abstract level definition',()=>{
  const definitions=model([level(0,'%1.')]);definitions.instances[0].overrides=[{level:0,definition:level(0,'%1)',5)}];
  const result=run([paragraph('A'),paragraph('B')],definitions);
  assert.deepEqual(result.paragraphs.map(p=>p.label),['5)','6)']);
});
test('out-of-range levels and invalid counters are reported without manufacturing labels',()=>{
  assert.equal(run([paragraph('A','1',9)],model([level(0,'%1.')])).warnings.length,1);
  assert.equal(run([paragraph('A')],model([level(0,'%1.',-1)])).warnings.length,1);
});
test('numbering input size is bounded before processing counters',()=>{
  assert.throws(()=>run([], {abstracts:Array.from({length:4097},(_,i)=>({id:String(i),levels:[]})),instances:[]}),/ขนาด|จำนวน/);
});
test('duplicate numbering definitions emit a warning rather than silently choosing the last definition',()=>{
  const definitions=model([level(0,'%1.')]);definitions.abstracts.push({id:'a',levels:[level(0,'%1.',7)]});
  const result=run([paragraph('Ambiguous')],definitions);
  assert.equal(result.paragraphs[0].text,'Ambiguous');assert.equal(result.warnings.length,1);
});
test('paragraph styles linked to numbering warn when their concrete numbering instance is absent',()=>{
  const definitions=model([level(0,'%1.',1,{styleId:'Heading1'})]);
  const result=run([{text:'Styled TOR',styleId:'Heading1'}],definitions);
  assert.equal(result.paragraphs[0].text,'Styled TOR');assert.equal(result.warnings.length,1);
});
test('invalid restart rules do not produce an apparently confirmed decimal clause label',()=>{
  const result=run([paragraph('Child','1',1)],model([level(0,'%1.'),level(1,'%1.%2',1,{restart:-1})]));
  assert.equal(result.paragraphs[0].text,'Child');assert.equal(result.warnings.length,1);
});

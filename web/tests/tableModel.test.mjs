import test from 'node:test';
import assert from 'node:assert/strict';
import {guessField,tableRows} from '../src/lib/tableModel.mjs';
test('English result headers are mapped to comparison instead of proposal',()=>{
  assert.equal(guessField('Result',2),'comparison');
  assert.equal(guessField('Compliance status',2),'comparison');
});
test('a template with a separate clause column does not repeat clause numbers in TOR text',()=>{
  const rows=tableRows({template:{profile:{columns:[{field:'number'},{field:'requirement'},{field:'proposal'}]}},requirements:[{id:'5.1',textSnapshot:'IPv6'}],rows:{'5.1':{proposal:'Supported'}},docs:[],evidence:[]});
  assert.deepEqual(rows,[['5.1','IPv6','Supported']]);
});
test('clause-number headers and product descriptions map to their actual roles',()=>{
  assert.equal(guessField('No.',0),'number');
  assert.equal(guessField('Clause No',0),'number');
  assert.equal(guessField('รายละเอียดผลิตภัณฑ์ที่เสนอ',2),'proposal');
});

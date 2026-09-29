import test from 'node:test';
import assert from 'node:assert/strict';
import {rankItems,assessClause} from '../src/lib/evidenceSearch.mjs';
test('numeric-only TOR ranks explicit supported speed ahead of unproven compatibility',()=>{
  const ranked=rankItems({products:[{id:'a',name:'25G'},{id:'b',name:'Multi rate'}],docs:[{id:'a-doc',role:'product',itemIds:['a'],searchText:'25 Gbps'},{id:'b-doc',role:'product',itemIds:['b'],searchText:'100/1000/10000/25000 Mbps'}]},'รองรับ 10 Gbps');
  assert.equal(ranked[0].id,'b');
  assert.ok(ranked[0].score>ranked[1].score);
});
test('per-clause Auto is blocked until the entire TOR has been reviewed',async()=>{
  await assert.rejects(()=>assessClause({mode:'auto',requirements:[{id:'1',reviewed:true,textSnapshot:'IPv6'},{id:'2',reviewed:false}],rows:{'1':{itemIds:['a']}},unreadablePages:[]},'1',()=>{throw new Error('must not read files');}),/ครบทุกข้อ/);
});

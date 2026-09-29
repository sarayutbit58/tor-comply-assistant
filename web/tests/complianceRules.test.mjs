import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRequirement } from '../src/lib/complianceRules.mjs';
const check = (tor, ...quotes) => evaluateRequirement(tor, quotes.map((text, i) => ({ id: String(i), text })));
test('minimum counts, equivalent bitrate units and reordered keywords pass', () => {
  assert.equal(check('มีพอร์ตไม่น้อยกว่า 24 พอร์ต', 'มี 48 พอร์ต').status, 'pass');
  assert.equal(check('รองรับ 10 Gbps', '100/1000/10000/25000 Mbps').status, 'pass');
  assert.equal(check('รองรับ IPv6 และ MPLS', 'MPLS รองรับ IPv6').status, 'pass');
});
test('higher interface speed alone does not prove backward compatibility', () => {
  assert.notEqual(check('รองรับ 10 Gbps', 'รองรับ 25 Gbps').status, 'pass');
});
test('explicit negative evidence and insufficient counts fail', () => {
  assert.equal(check('รองรับ IPv6', 'ไม่รองรับ IPv6').status, 'fail');
  assert.equal(check('มีพอร์ตไม่น้อยกว่า 24 พอร์ต', 'มี 16 พอร์ต').status, 'fail');
});
test('evidence from several offered components must cover every condition', () => {
  assert.equal(check('รองรับ IPv6 และรับประกัน 3 ปี', 'รองรับ IPv6').status, 'pending');
  assert.equal(check('รองรับ IPv6 และรับประกัน 3 ปี', 'รองรับ IPv6', 'รับประกัน 3 ปี').status, 'pass');
});
test('IIG capacity cannot be borrowed from a domestic NIX line', () => {
  assert.notEqual(check('IIG ไม่น้อยกว่า 200 Gbps', 'NIX 400 Gbps และ IIG 100 Gbps').status, 'pass');
});
test('unknown terms and optional capabilities never auto pass', () => {
  assert.equal(check('รองรับ Quantum Banana', 'รองรับ IPv6').status, 'pending');
  assert.equal(check('รองรับ IPv6', 'IPv6 optional license required').status, 'pending');
});
test('conflicting assertions are reviewable rather than silently accepted', () => {
  assert.equal(check('รองรับ IPv6', 'รองรับ IPv6', 'ไม่รองรับ IPv6').status, 'pending');
});
test('English negation is recognized without corrupting the word support',()=>{
  assert.equal(check('Support IPv6','Does not support IPv6').status,'fail');
  assert.equal(check('Support IPv6','IPv6 supported').status,'pass');
});
test('bare standard versions, bandwidth ratios and video frame rates cannot disappear',()=>{
  assert.notEqual(check('ISO 27001','ISO 9001').status,'pass');
  assert.notEqual(check('Guarantee Bandwidth 1:1','Guarantee Bandwidth 1:10').status,'pass');
  assert.equal(check('ไม่น้อยกว่า 30 fps','60 fps').status,'pass');
});
test('numeric-only requirements still respect negation, optional features and source bounds',()=>{
  assert.equal(check('รองรับ 10 Gbps','ไม่รองรับ 10 Gbps').status,'fail');
  assert.equal(check('รองรับ 10 Gbps','10 Gbps optional license required').status,'pending');
  assert.equal(check('response time ไม่เกิน 10 ms','response time มากกว่า 10 ms').status,'fail');
  assert.equal(check('อย่างน้อย 24 พอร์ต','ไม่เกิน 48 พอร์ต').status,'pending');
  assert.equal(check('อย่างน้อย 24 พอร์ต','อย่างน้อย 48 พอร์ต').status,'pass');
});
test('conflicting occurrences inside one excerpt do not pass',()=>{
  assert.equal(check('Support IPv6','IPv6 supported; IPv6 is not supported').status,'pending');
});
test('bit and byte units stay distinct and numeric values cannot cross metric dimensions',()=>{
  assert.equal(check('Storage speed at least 100 MBps','Storage speed 100 Mbps').status,'fail');
  assert.equal(check('RAM ไม่น้อยกว่า 16 GB','RAM 16 Gb').status,'fail');
  assert.notEqual(check('หน่วยความจำไม่น้อยกว่า 32 GB','หน่วยความจำ DDR4; storage 512 GB').status,'pass');
});
test('postfix negative capability values fail',()=>{
  assert.equal(check('รองรับ IPv6','IPv6 unsupported').status,'fail');
  assert.equal(check('รองรับ IPv6','IPv6 No').status,'fail');
});

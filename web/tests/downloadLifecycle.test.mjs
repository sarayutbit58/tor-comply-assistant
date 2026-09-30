import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadBlob,clearDownload} from '../src/lib/download.js';
test('generated downloads expose a reusable link and release previous/closed resources',()=>{
 const originals={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 const events=[],revoked=[];let sequence=0,clicks=0;
 globalThis.document={createElement:()=>({click:()=>clicks++,remove:()=>{}}),body:{append:()=>{}}};globalThis.window={dispatchEvent:event=>events.push(event)};
 globalThis.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};URL.createObjectURL=()=>`blob:qa-${++sequence}`;URL.revokeObjectURL=url=>revoked.push(url);
 try {
  downloadBlob(new Blob(['first']),'first.pdf');assert.equal(events[0].type,'tor-download-ready');assert.equal(events[0].detail.filename,'first.pdf');assert.equal(events[0].detail.size,5);assert.equal(clicks,1);
  downloadBlob(new Blob(['second']),'second.xlsx');assert.ok(revoked.includes('blob:qa-1'));assert.equal(events.at(-1).detail.url,'blob:qa-2');assert.equal(clicks,2);
  clearDownload();assert.ok(revoked.includes('blob:qa-2'));assert.equal(events.at(-1).type,'tor-download-expired');
 } finally {clearDownload();globalThis.document=originals.document;globalThis.window=originals.window;globalThis.CustomEvent=originals.CustomEvent;URL.createObjectURL=originals.create;URL.revokeObjectURL=originals.revoke;}
});

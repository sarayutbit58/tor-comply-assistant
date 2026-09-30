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
test('small-file fallback is binary-only and late encoders cannot replace a new download',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent,FileReader:globalThis.FileReader};const events=[],readers=[];
 globalThis.document={createElement:()=>({click:()=>{},remove:()=>{}}),body:{append:()=>{}}};globalThis.window={dispatchEvent:event=>events.push(event)};globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
 globalThis.FileReader=class{constructor(){readers.push(this);}readAsDataURL(){this.readyState=1;}abort(){this.readyState=2;}};
 try {
  downloadBlob(new Blob(['first'],{type:'application/pdf'}),'first.pdf');assert.equal(readers.length,1);readers[0].result='data:application/pdf;base64,Zmlyc3Q=';readers[0].onload();assert.equal(events.at(-1).detail.href,'data:application/octet-stream;base64,Zmlyc3Q=');
  downloadBlob(new Blob(['second']),'second.docx');const count=events.length;readers[0].onload();assert.equal(events.length,count);
  downloadBlob(new Blob([new Uint8Array(1024*1024+1)]),'large.torproj');assert.equal(readers.length,2);assert.equal(events.at(-1).detail.filename,'large.torproj');assert.equal(events.at(-1).detail.href,undefined);
 } finally {clearDownload();for(const [key,value]of Object.entries(originals))globalThis[key]=value;}
});

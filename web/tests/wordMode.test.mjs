import test from 'node:test';
import assert from 'node:assert/strict';
import {canExportNativeWord} from '../src/lib/wordMode.mjs';
test('legacy DOCX profiles without native layout use normalized rows rather than dereferencing missing metadata',()=>{
 for(const native of [undefined,null,{}, {sourceTables:[]}])assert.equal(canExportNativeWord({format:'docx',native}),false);
});
test('valid single and selected multi-table DOCX layouts retain native export',()=>{
 assert.equal(canExportNativeWord({format:'docx',native:{tableIndex:1,headerRow:0}}),true);
 assert.equal(canExportNativeWord({format:'docx',native:{sourceTables:[{tableIndex:1,headerRow:0},{tableIndex:2,headerRow:1}]}}),true);
 assert.equal(canExportNativeWord({format:'docx',native:{tableIndex:1,headerRow:0,rebuildTable:true}}),false);
});

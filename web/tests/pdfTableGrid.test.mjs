import test from 'node:test';
import assert from 'node:assert/strict';
import {detectTableGrid} from '../src/lib/pdfTableGrid.mjs';
test('a colored header keeps its bottom border instead of swallowing the first body row',()=>{
  const width=200,height=400,data=new Uint8ClampedArray(width*height*4).fill(255);
  const black=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};
  for(let x=10;x<=190;x++)for(let y=60;y<=100;y++)black(x,y);
  for(const x of [10,50,100,150,190])for(let y=60;y<=300;y++)black(x,y);
  for(const y of [60,100,180,300])for(let x=10;x<=190;x++)black(x,y);
  const grid=detectTableGrid({width,height,data},4,[.14,.26]);
  assert.ok(grid);
  assert.ok(grid.rows.some(y=>Math.abs(y-.25)<.005));
  assert.ok(grid.rows.some(y=>Math.abs(y-.45)<.005));
  assert.equal(grid.edges.length,5);
});

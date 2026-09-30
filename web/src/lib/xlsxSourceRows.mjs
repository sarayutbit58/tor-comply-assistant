function cellAddress(value) {
  const match=/^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/iu.exec(value);
  if (!match) throw new Error('ช่วงรวมเซลล์ XLSX ไม่ถูกต้อง');
  const column=[...match[1].toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1, row=Number(match[2]);
  if (column>16383 || row>1048576) throw new Error('ช่วงรวมเซลล์ XLSX ไม่ถูกต้อง');
  return {column,row};
}
export function prepareXlsxSourceRows(input, mergeReferences=[], {sheetNames=[]}={}) {
  if (!Array.isArray(input) || input.length>10000 || !Array.isArray(mergeReferences) || mergeReferences.length>10000) throw new Error('จำนวนแถวหรือรวมเซลล์ XLSX เกินขนาดที่รองรับ');
  const rows=input.map(row=>{
    if (!Number.isInteger(row.row) || row.row<1 || row.row>1048576 || !Array.isArray(row.cells) || row.cells.length>101) throw new Error('แถว XLSX ไม่ถูกต้อง');
    return {...row,cells:[...row.cells],cellMerges:{...(row.cellMerges || {})},ambiguousColumns:[...(row.ambiguousColumns || [])]};
  }).sort((a,b)=>a.row-b.row);
  const byRow=new Map(rows.map(row=>[row.row,row]));
  if (byRow.size!==rows.length) throw new Error('เลขแถว XLSX ซ้ำ');
  const warnings=new Set();let covered=0;
  if (sheetNames.length>1) warnings.add('อ่านเฉพาะแผ่นงานแรก '+sheetNames[0]+'; ไม่ได้นำเข้าแผ่นงาน '+sheetNames.slice(1).join(', '));
  function lowerBound(number) {
    let left=0,right=rows.length;
    while(left<right){const middle=Math.floor((left+right)/2);if(rows[middle].row<number)left=middle+1;else right=middle;}
    return left;
  }
  for (const reference of mergeReferences) {
    if (typeof reference!=='string') throw new Error('ช่วงรวมเซลล์ XLSX ไม่ถูกต้อง');
    const parts=reference.split(':');
    if (parts.length>2) throw new Error('ช่วงรวมเซลล์ XLSX ไม่ถูกต้อง');
    const start=cellAddress(parts[0]),end=cellAddress(parts[1] || parts[0]);
    if (end.column<start.column || end.row<start.row) throw new Error('ช่วงรวมเซลล์ XLSX ไม่ถูกต้อง');
    if (start.column>100) {warnings.add('ช่วงรวมเซลล์ '+reference+' อยู่เกินคอลัมน์ที่อ่าน');continue;}
    for(let index=lowerBound(start.row);index<rows.length && rows[index].row<=end.row;index++) {
      const row=rows[index];
      for(let column=start.column;column<=Math.min(end.column,100);column++) {
        covered++;if(covered>100000) throw new Error('จำนวนเซลล์รวม XLSX เกินขนาดที่รองรับ');
        const isAnchor=row.row===start.row && column===start.column;
        if (row.cellMerges[column]) {
          row.ambiguousColumns.push(column);warnings.add('ช่วงรวมเซลล์ XLSX ซ้อนกันที่แถว '+row.row);
        }
        row.cellMerges[column]={anchorRow:start.row,anchorColumn:start.column,endRow:end.row,endColumn:end.column,isAnchor};
        if (end.column!==start.column) {
          row.ambiguousColumns.push(column);warnings.add('ช่วงรวมเซลล์ '+reference+' คร่อมหลายคอลัมน์ โปรดตรวจคอลัมน์ข้อกำหนด');
        }
        if (!isAnchor && String(row.cells[column] || '').trim()) {
          row.ambiguousColumns.push(column);warnings.add('แถว '+row.row+' มีข้อความในเซลล์ต่อเนื่องของช่วงรวมเซลล์ '+reference+' โปรดตรวจต้นฉบับ');
        }
      }
      row.ambiguousColumns=[...new Set(row.ambiguousColumns)];
    }
  }
  return {rows,warnings:[...warnings]};
}

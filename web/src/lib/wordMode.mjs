const target=value=>value&&Number.isInteger(value.tableIndex)&&value.tableIndex>=0&&Number.isInteger(value.headerRow)&&value.headerRow>=0;
export function canExportNativeWord(template) {
 if(template?.format!=='docx'||!template.native||template.native.rebuildTable)return false;
 return template.native.sourceTables!==undefined?Array.isArray(template.native.sourceTables)&&template.native.sourceTables.length>0&&template.native.sourceTables.every(target):Boolean(target(template.native));
}

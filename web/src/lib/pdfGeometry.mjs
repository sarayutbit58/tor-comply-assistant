export function evidenceBoxToPdf(box, visiblePage) {
  if (!Array.isArray(box) || box.length !== 4) throw new Error('กรอบไฮไลต์ไม่ถูกต้อง');
  const [x, top, width, height] = box;
  if (![x, top, width, height, visiblePage.x, visiblePage.y, visiblePage.width, visiblePage.height].every(Number.isFinite)) throw new Error('ตำแหน่ง PDF ไม่ถูกต้อง');
  if (!(x >= 0 && top >= 0 && width > 0 && height > 0 && x + width <= 1 && top + height <= 1 && visiblePage.width > 0 && visiblePage.height > 0)) throw new Error('กรอบไฮไลต์อยู่นอกหน้า PDF');
  return {
    x: visiblePage.x + x * visiblePage.width,
    y: visiblePage.y + (1 - top - height) * visiblePage.height,
    width: width * visiblePage.width,
    height: height * visiblePage.height,
  };
}

export function splitPdfLabel(number) {
  const digits = '๐๑๒๓๔๕๖๗๘๙';
  const label = `ข้อที่ ${String(number).replace(/[๐-๙]/gu, digit => String(digits.indexOf(digit)))}`;
  const runs = [];
  for (const character of label) {
    if (!/[\u0E00-\u0E7F\x20-\x7E]/u.test(character)) throw new Error('เลขข้อมีอักขระที่ PDF ไม่รองรับ');
    const font = /[\u0E00-\u0E7F]/u.test(character) ? 'thai' : 'latin';
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text += character;
    else runs.push({ text: character, font });
  }
  return runs;
}

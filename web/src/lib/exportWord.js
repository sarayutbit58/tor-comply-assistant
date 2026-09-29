export async function exportComplyWord(project) {
  const { BorderStyle, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
  const widths = [5000, 4300, 2800, 3200];
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9DD' };
  const borders = { top: border, bottom: border, left: border, right: border };

  function cell(text, width, bold = false) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders,
      children: [new Paragraph({ children: [new TextRun({ text: text || ' ', bold, font: 'TH Sarabun New', size: 28 })] })],
    });
  }

  const header = new TableRow({ children: [
    cell('รายละเอียดการดำเนินงาน', widths[0], true),
    cell('รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ', widths[1], true),
    cell('เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ', widths[2], true),
    cell('เอกสารอ้างอิง ไฟล์ใด หน้าใด', widths[3], true),
  ] });
  const body = project.requirements.map(requirement => {
    const response = project.rows[requirement.id] || {};
    const references = project.evidence.filter(item => item.requirementId === requirement.id).map(item => {
      const document = project.docs.find(doc => doc.id === item.docId);
      const page = item.printedPage ? `หน้า ${item.printedPage} (PDF ${item.pdfPage})` : `หน้า PDF ${item.pdfPage}`;
      return `${document?.name || item.docId} ${page}`;
    });
    return new TableRow({ children: [
      cell(`ข้อ ${requirement.id} ${requirement.textSnapshot}`, widths[0]),
      cell(response.proposal || '', widths[1]),
      cell(response.comparison || 'รอตรวจสอบ', widths[2]),
      cell(references.join('\n'), widths[3]),
    ] });
  });
  const document = new Document({ sections: [{
    properties: { page: { size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
    children: [
      new Paragraph({ children: [new TextRun({ text: `ตาราง Comply TOR ${project.name}`, bold: true, font: 'TH Sarabun New', size: 32 })] }),
      new Paragraph({ children: [] }),
      new Table({ width: { size: widths.reduce((sum, value) => sum + value, 0), type: WidthType.DXA }, rows: [header, ...body] }),
    ],
  }] });
  return Packer.toBlob(document);
}

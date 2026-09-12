import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { Project } from "./types";

const border = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "000000",
};

const borders = { top: border, bottom: border, left: border, right: border };

function cell(text: string, width: number, bold = false) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || " ",
            bold,
            font: "TH Sarabun New",
            size: 28, // 14pt
          }),
        ],
      }),
    ],
  });
}

function formatRefs(
  refs: { docId: string; page: number }[],
  docs: { id: string; name: string }[]
) {
  if (!refs.length) return "";
  return refs
    .map((r) => {
      const doc = docs.find((d) => d.id === r.docId);
      const name = doc?.name ?? r.docId;
      return `${name} หน้า ${r.page}`;
    })
    .join("\n");
}

export async function exportComplyWord(project: Project) {
  // Red Cross filled layout: ลำดับ + TOR + bidder + เปรียบเทียบ + refs
  const colW = [700, 2400, 2200, 2200, 2000];
  const header = new TableRow({
    children: [
      cell("ลำดับที่", colW[0], true),
      cell("รายละเอียดการดำเนินงาน", colW[1], true),
      cell("รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ", colW[2], true),
      cell("เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ", colW[3], true),
      cell("เอกสารอ้างอิง", colW[4], true),
    ],
  });

  const body = project.requirements.map((req) => {
    const row = project.rows[req.id];
    const torText = [req.title, req.textSnapshot].filter(Boolean).join("\n");
    return new TableRow({
      children: [
        cell(req.id, colW[0]),
        cell(torText, colW[1]),
        cell(row?.bidderText ?? "", colW[2]),
        cell(row?.compareText ?? "", colW[3]),
        cell(formatRefs(row?.refs ?? [], project.docs), colW[4]),
      ],
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `ตารางเปรียบเทียบคุณลักษณะ — ${project.name}`,
                bold: true,
                font: "TH Sarabun New",
                size: 32,
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: colW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
            rows: [header, ...body],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safe = project.name.replace(/[^\wก-๙\-]+/g, "_").slice(0, 60);
  saveAs(blob, `comply-${safe || "project"}.docx`);
}

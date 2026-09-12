/**
 * Frozen MVP contract — mirror of /contracts/v1.openapi.yaml
 * v1 export matches Red Cross filled layout (includes เปรียบเทียบ).
 * No LLM on the hot path.
 */

/** Stable TOR section number, e.g. "3.1" or "5.10.1" — never a char offset. */
export type SectionId = string;

/** Project-scoped document reference for Word col เอกสารอ้างอิง. */
export type DocRef = {
  docId: string;
  page: number; // 1-based
};

export type ProjectDoc = {
  /** Project-scoped id (not a global catalog). */
  id: string;
  name: string;
  /** data URL or object URL for demo PDFs; optional */
  dataUrl?: string;
  mimeType?: string;
  addedAt: string;
};

export type Requirement = {
  id: SectionId;
  title: string;
  /** Frozen at upsert so re-import cannot break rows/refs. */
  textSnapshot: string;
};

export type ComplyRow = {
  requirementId: SectionId;
  /** Word col: รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ */
  bidderText: string;
  /** Word col: เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ */
  compareText: string;
  /** Word col: เอกสารอ้างอิง */
  refs: DocRef[];
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  requirements: Requirement[];
  docs: ProjectDoc[];
  /** Keyed by Requirement.id */
  rows: Record<SectionId, ComplyRow>;
};

export type SeedFile = {
  projectSeed: string;
  count: number;
  requirements: Requirement[];
};

/** Word export columns — Red Cross filled layout (v1 flip). */
export const EXPORT_COLUMNS_V1 = [
  "ลำดับที่",
  "รายละเอียดการดำเนินงาน",
  "รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ",
  "เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ",
  "เอกสารอ้างอิง",
] as const;

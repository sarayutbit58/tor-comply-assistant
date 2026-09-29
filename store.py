"""Small local SQLite store for TOR projects and source-backed evidence."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

from core import extract_requirements, parse_text_page, suggest_documents


class Store:
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.files = self.root / "files"
        self.files.mkdir(parents=True, exist_ok=True)
        self.db = self.root / "tor_comply.sqlite3"
        with self._connect() as con:
            con.executescript("""
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, tor_filename TEXT,
                    tor_path TEXT, unreadable_pages TEXT NOT NULL DEFAULT '[]',
                    ocr_pages TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS requirements (
                    id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, number TEXT NOT NULL,
                    text TEXT NOT NULL, source_page INTEGER, proposal TEXT NOT NULL DEFAULT '',
                    comparison TEXT NOT NULL DEFAULT 'รอตรวจสอบ', product_id INTEGER,
                    source_method TEXT NOT NULL DEFAULT 'manual'
                );
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL, model TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, product_id INTEGER,
                    filename TEXT NOT NULL, stored_path TEXT NOT NULL, page_count INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS document_pages (
                    document_id INTEGER NOT NULL, page INTEGER NOT NULL, text TEXT NOT NULL,
                    PRIMARY KEY (document_id, page)
                );
                CREATE TABLE IF NOT EXISTS evidence (
                    id INTEGER PRIMARY KEY, requirement_id INTEGER NOT NULL, document_id INTEGER NOT NULL,
                    pdf_page INTEGER NOT NULL, printed_page TEXT NOT NULL DEFAULT '',
                    keyword TEXT NOT NULL DEFAULT '', box TEXT NOT NULL
                );
            """)
            project_columns = {row["name"] for row in con.execute("PRAGMA table_info(projects)")}
            requirement_columns = {row["name"] for row in con.execute("PRAGMA table_info(requirements)")}
            if "ocr_pages" not in project_columns:
                con.execute("ALTER TABLE projects ADD COLUMN ocr_pages TEXT NOT NULL DEFAULT '[]'")
            if "source_method" not in requirement_columns:
                con.execute("ALTER TABLE requirements ADD COLUMN source_method TEXT NOT NULL DEFAULT 'manual'")

    @contextmanager
    def _connect(self):
        con = sqlite3.connect(self.db)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
        try:
            with con:
                yield con
        finally:
            con.close()

    def _write_file(self, filename: str, content: bytes) -> Path:
        suffix = Path(filename).suffix.lower()
        path = self.files / f"{uuid.uuid4().hex}{suffix}"
        path.write_bytes(content)
        return path

    def create_project(self, name: str, filename: str | None, content: bytes | None) -> int:
        name = name.strip()
        if not name:
            raise ValueError("กรุณาระบุชื่อโครงการ")
        path = None
        requirements = []
        unreadable = []
        if filename is not None and content is not None:
            filename = Path(filename).name
            if Path(filename).suffix.lower() not in (".pdf", ".docx"):
                raise ValueError("TOR ต้องเป็น PDF หรือ DOCX")
            path = self._write_file(filename, content)
            try:
                requirements, unreadable = extract_requirements(path)
            except Exception:
                path.unlink(missing_ok=True)
                raise
        with self._connect() as con:
            cursor = con.execute(
                "INSERT INTO projects(name,tor_filename,tor_path,unreadable_pages,created_at) VALUES(?,?,?,?,?)",
                (name, filename, str(path) if path else None, json.dumps(unreadable), datetime.now(timezone.utc).isoformat()),
            )
            project_id = cursor.lastrowid
            con.executemany(
                "INSERT INTO requirements(project_id,number,text,source_page,source_method) VALUES(?,?,?,?,?)",
                [(project_id, r["number"], r["text"], r["source_page"], "text") for r in requirements],
            )
        return project_id

    def import_ocr_text(self, project_id: int, page: int, text: str) -> int:
        candidates = parse_text_page(text, page)
        if not candidates:
            raise ValueError("OCR ไม่พบข้อความที่นำเข้าได้")
        with self._connect() as con:
            project = self._require_project(con, project_id)
            unreadable = json.loads(project["unreadable_pages"])
            ocr_pages = json.loads(project["ocr_pages"])
            if page not in unreadable:
                raise ValueError("หน้านี้ไม่มีสถานะรอ OCR หรือถูกนำเข้าแล้ว")
            con.executemany(
                "INSERT INTO requirements(project_id,number,text,source_page,source_method) VALUES(?,?,?,?,?)",
                [(project_id, item["number"], item["text"], page, "ocr") for item in candidates],
            )
            unreadable.remove(page)
            ocr_pages.append(page)
            con.execute("UPDATE projects SET unreadable_pages=?,ocr_pages=? WHERE id=?", (json.dumps(unreadable), json.dumps(ocr_pages), project_id))
        return len(candidates)

    def list_projects(self) -> list[dict]:
        with self._connect() as con:
            return [dict(row) for row in con.execute("SELECT id,name,tor_filename,created_at FROM projects ORDER BY id DESC")]

    def add_requirement(self, project_id: int, number: str, text: str, source_page: int | None = None) -> int:
        if not number.strip() or not text.strip():
            raise ValueError("กรุณาระบุเลขข้อและรายละเอียด TOR")
        with self._connect() as con:
            self._require_project(con, project_id)
            return con.execute(
                "INSERT INTO requirements(project_id,number,text,source_page) VALUES(?,?,?,?)",
                (project_id, number.strip(), text.strip(), source_page),
            ).lastrowid

    def add_product(self, project_id: int, name: str, model: str = "") -> int:
        if not name.strip():
            raise ValueError("กรุณาระบุชื่อสินค้า/บริการ")
        with self._connect() as con:
            self._require_project(con, project_id)
            return con.execute(
                "INSERT INTO products(project_id,name,model) VALUES(?,?,?)", (project_id, name.strip(), model.strip())
            ).lastrowid

    def add_document(self, project_id: int, product_id: int | None, filename: str, content: bytes) -> int:
        filename = Path(filename).name
        if Path(filename).suffix.lower() != ".pdf":
            raise ValueError("เอกสารหลักฐานต้องเป็น PDF")
        with self._connect() as con:
            self._require_project(con, project_id)
            if product_id is not None:
                self._require_product(con, product_id, project_id)
        path = self._write_file(filename, content)
        try:
            with pdfplumber.open(path) as pdf:
                page_text = [(index, page.extract_text() or "") for index, page in enumerate(pdf.pages, 1)]
        except Exception:
            path.unlink(missing_ok=True)
            raise
        with self._connect() as con:
            cursor = con.execute(
                "INSERT INTO documents(project_id,product_id,filename,stored_path,page_count) VALUES(?,?,?,?,?)",
                (project_id, product_id, filename, str(path), len(page_text)),
            )
            document_id = cursor.lastrowid
            con.executemany(
                "INSERT INTO document_pages(document_id,page,text) VALUES(?,?,?)",
                [(document_id, page, text) for page, text in page_text],
            )
        return document_id

    def add_evidence(self, requirement_id: int, document_id: int, pdf_page: int, printed_page: str, keyword: str, box: list[float]) -> int:
        if len(box) != 4 or any(not isinstance(value, (int, float)) for value in box):
            raise ValueError("ตำแหน่งไฮไลต์ไม่ถูกต้อง")
        x, y, width, height = box
        if not (0 <= x < 1 and 0 <= y < 1 and 0 < width <= 1 - x and 0 < height <= 1 - y):
            raise ValueError("ตำแหน่งไฮไลต์อยู่นอกหน้าเอกสาร")
        with self._connect() as con:
            req = con.execute("SELECT project_id FROM requirements WHERE id=?", (requirement_id,)).fetchone()
            doc = con.execute("SELECT project_id,page_count FROM documents WHERE id=?", (document_id,)).fetchone()
            if not req or not doc or req["project_id"] != doc["project_id"]:
                raise ValueError("ข้อ TOR และเอกสารไม่ได้อยู่ในโครงการเดียวกัน")
            if not 1 <= pdf_page <= doc["page_count"]:
                raise ValueError("เลขหน้า PDF ไม่ถูกต้อง")
            return con.execute(
                "INSERT INTO evidence(requirement_id,document_id,pdf_page,printed_page,keyword,box) VALUES(?,?,?,?,?,?)",
                (requirement_id, document_id, pdf_page, printed_page.strip(), keyword.strip(), json.dumps(box)),
            ).lastrowid

    def delete_evidence(self, evidence_id: int) -> None:
        with self._connect() as con:
            row = con.execute("SELECT requirement_id FROM evidence WHERE id=?", (evidence_id,)).fetchone()
            if not row:
                raise ValueError("ไม่พบหลักฐาน")
            con.execute("DELETE FROM evidence WHERE id=?", (evidence_id,))
            con.execute("UPDATE requirements SET comparison='รอตรวจสอบ' WHERE id=? AND comparison='ตรงตามข้อกำหนด'", (row["requirement_id"],))

    def update_requirement(self, requirement_id: int, changes: dict) -> None:
        allowed = {"number", "text", "source_page", "proposal", "comparison", "product_id"}
        if not changes or set(changes) - allowed:
            raise ValueError("ฟิลด์ที่แก้ไขไม่ถูกต้อง")
        if "comparison" in changes and changes["comparison"] not in ("รอตรวจสอบ", "ตรงตามข้อกำหนด", "ไม่ตรงตามข้อกำหนด"):
            raise ValueError("ผลเปรียบเทียบไม่ถูกต้อง")
        with self._connect() as con:
            req = con.execute("SELECT * FROM requirements WHERE id=?", (requirement_id,)).fetchone()
            if not req:
                raise ValueError("ไม่พบข้อ TOR")
            if changes.get("product_id") is not None and "product_id" in changes:
                self._require_product(con, changes["product_id"], req["project_id"])
            proposal = changes.get("proposal", req["proposal"])
            comparison = changes.get("comparison", req["comparison"])
            if any(key in changes and changes[key] != req[key] for key in ("number", "text", "source_page")):
                comparison = "รอตรวจสอบ"
                changes["comparison"] = comparison
            if "product_id" in changes and changes["product_id"] != req["product_id"] and "comparison" not in changes:
                comparison = "รอตรวจสอบ"
                changes["comparison"] = comparison
            if req["source_method"] == "ocr" and ("number" in changes or "text" in changes):
                changes["source_method"] = "ocr-reviewed"
            if comparison == "ตรงตามข้อกำหนด":
                documents = con.execute("""
                    SELECT d.product_id FROM evidence e JOIN documents d ON d.id=e.document_id
                    WHERE e.requirement_id=?
                """, (requirement_id,)).fetchall()
                if not proposal.strip() or not documents:
                    raise ValueError("ต้องมีรายละเอียดที่เสนอและหลักฐานก่อนระบุตรงตามข้อกำหนด")
                selected_product = changes.get("product_id", req["product_id"])
                if selected_product is not None and not any(doc["product_id"] in (None, selected_product) for doc in documents):
                    raise ValueError("หลักฐานไม่ตรงกับสินค้า/บริการที่เลือก")
            clause = ",".join(f"{key}=?" for key in changes)
            con.execute(f"UPDATE requirements SET {clause} WHERE id=?", (*changes.values(), requirement_id))

    def snapshot(self, project_id: int) -> dict:
        with self._connect() as con:
            project = self._require_project(con, project_id)
            requirements = [dict(row) for row in con.execute("SELECT * FROM requirements WHERE project_id=? ORDER BY id", (project_id,))]
            products = [dict(row) for row in con.execute("SELECT * FROM products WHERE project_id=? ORDER BY id", (project_id,))]
            documents = [dict(row) for row in con.execute("SELECT id,project_id,product_id,filename,page_count FROM documents WHERE project_id=? ORDER BY id", (project_id,))]
            evidence = [dict(row) for row in con.execute(
                "SELECT e.*,d.filename FROM evidence e JOIN documents d ON e.document_id=d.id WHERE d.project_id=? ORDER BY e.id", (project_id,)
            )]
        for item in evidence:
            item["box"] = json.loads(item["box"])
        result = dict(project)
        result["unreadable_pages"] = json.loads(result["unreadable_pages"])
        result["ocr_pages"] = json.loads(result["ocr_pages"])
        result.update({"requirements": requirements, "products": products, "documents": documents, "evidence": evidence})
        return result

    def export_rows(self, project_id: int) -> list[dict]:
        snapshot = self.snapshot(project_id)
        result = []
        for requirement in snapshot["requirements"]:
            evidence = [item for item in snapshot["evidence"] if item["requirement_id"] == requirement["id"]]
            result.append({**requirement, "evidence": evidence})
        return result

    def suggestions(self, requirement_id: int) -> list[dict]:
        with self._connect() as con:
            req = con.execute("SELECT project_id,text FROM requirements WHERE id=?", (requirement_id,)).fetchone()
            if not req:
                raise ValueError("ไม่พบข้อ TOR")
            docs = [dict(row) for row in con.execute("""
                SELECT d.id,d.filename,COALESCE(p.name,'') AS product_name,
                       COALESCE(GROUP_CONCAT(dp.text,' '),'') AS text
                FROM documents d LEFT JOIN products p ON p.id=d.product_id
                LEFT JOIN document_pages dp ON dp.document_id=d.id
                WHERE d.project_id=? GROUP BY d.id
            """, (req["project_id"],))]
        return [{key: value for key, value in item.items() if key != "text"} for item in suggest_documents(req["text"], docs)]

    def document_info(self, document_id: int) -> dict:
        with self._connect() as con:
            row = con.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
            if not row:
                raise ValueError("ไม่พบเอกสาร")
            return dict(row)

    def document_page_text(self, document_id: int, page: int) -> str:
        with self._connect() as con:
            row = con.execute("SELECT text FROM document_pages WHERE document_id=? AND page=?", (document_id, page)).fetchone()
            if not row:
                raise ValueError("ไม่พบหน้าเอกสาร")
            return row["text"]

    def marks_for_document(self, document_id: int) -> list[dict]:
        with self._connect() as con:
            rows = con.execute("""
                SELECT e.pdf_page,e.box,r.number
                FROM evidence e JOIN requirements r ON r.id=e.requirement_id
                WHERE e.document_id=? ORDER BY e.pdf_page,e.id
            """, (document_id,)).fetchall()
        return [{"pdf_page": row["pdf_page"], "box": json.loads(row["box"]), "number": row["number"]} for row in rows]

    @staticmethod
    def _require_project(con, project_id: int):
        row = con.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
        if not row:
            raise ValueError("ไม่พบโครงการ")
        return row

    @staticmethod
    def _require_product(con, product_id: int, project_id: int):
        row = con.execute("SELECT id FROM products WHERE id=? AND project_id=?", (product_id, project_id)).fetchone()
        if not row:
            raise ValueError("ไม่พบสินค้า/บริการในโครงการนี้")

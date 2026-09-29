"""Local, dependency-light web server for the TOR comply application."""

from __future__ import annotations

import argparse
import cgi
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from core import annotate_pdf, export_table
from store import Store


HERE = Path(__file__).resolve().parent
MAX_BODY = 40 * 1024 * 1024
STATIC = {"/": "index.html", "/app.js": "app.js", "/style.css": "style.css", "/brand-logo.png": "brand-logo.png"}


def _poppler() -> str:
    installed = shutil.which("pdftoppm")
    bundled = Path(sys.executable).resolve().parents[1] / "native" / "poppler" / "Library" / "bin" / "pdftoppm.exe"
    if installed:
        return installed
    if bundled.exists():
        return str(bundled)
    raise RuntimeError("ไม่พบ pdftoppm สำหรับแสดงหน้า PDF")


def _node() -> str:
    installed = shutil.which("node")
    bundled = Path(sys.executable).resolve().parents[1] / "node" / "bin" / "node.exe"
    if installed:
        return installed
    if bundled.exists():
        return str(bundled)
    raise RuntimeError("ไม่พบ Node.js สำหรับ OCR")


def make_server(host: str, port: int, store: Store) -> ThreadingHTTPServer:
    if host != "127.0.0.1":
        raise ValueError("Only loopback binding is allowed while the app has no user authentication")

    class Handler(BaseHTTPRequestHandler):
        server_version = "TORComply/1.0"

        def _send_json(self, value, status=200):
            payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(payload)

        def _send_file(self, path: Path, content_type: str, download: str | None = None):
            if not path.exists():
                raise FileNotFoundError(path)
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(path.stat().st_size))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if download:
                self.send_header("Content-Disposition", f'attachment; filename="{download}"')
            self.end_headers()
            with path.open("rb") as stream:
                shutil.copyfileobj(stream, self.wfile, length=1024 * 1024)

        def _check_origin(self):
            origin = self.headers.get("Origin")
            allowed = {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}
            if origin and origin not in allowed:
                raise PermissionError("คำขอจากเว็บไซต์อื่นถูกปฏิเสธ")

        def _body_size(self):
            size = int(self.headers.get("Content-Length", "0"))
            if size < 0 or size > MAX_BODY:
                raise ValueError("ไฟล์เกินขนาดสูงสุด 40 MB")
            return size

        def _json_body(self):
            size = self._body_size()
            if size > 1024 * 1024:
                raise ValueError("ข้อมูล JSON มีขนาดใหญ่เกินไป")
            try:
                value = json.loads(self.rfile.read(size))
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise ValueError("ข้อมูล JSON ไม่ถูกต้อง") from None
            if not isinstance(value, dict):
                raise ValueError("ข้อมูลต้องเป็น JSON object")
            return value

        def _multipart(self):
            self._body_size()
            if not self.headers.get("Content-Type", "").startswith("multipart/form-data"):
                raise ValueError("กรุณาส่งไฟล์ด้วย multipart/form-data")
            return cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers["Content-Type"], "CONTENT_LENGTH": self.headers["Content-Length"]},
                keep_blank_values=True,
            )

        def _handle(self, method: str):
            path = urlparse(self.path).path
            if method == "GET" and path in STATIC:
                file = HERE / STATIC[path]
                content_type = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
                return self._send_file(file, content_type)
            if method == "GET" and path == "/api/projects":
                return self._send_json(store.list_projects())
            if method == "POST" and path == "/api/projects":
                if self.headers.get("Content-Type", "").startswith("multipart/form-data"):
                    form = self._multipart()
                    name = form.getvalue("name", "")
                    field = form["tor"] if "tor" in form else None
                    filename = field.filename if field is not None and field.filename else None
                    content = field.file.read() if filename else None
                else:
                    body = self._json_body()
                    name, filename, content = body.get("name", ""), None, None
                project_id = store.create_project(name, filename, content)
                return self._send_json({"id": project_id}, 201)
            match = re.fullmatch(r"/api/projects/(\d+)", path)
            if method == "GET" and match:
                return self._send_json(store.snapshot(int(match[1])))
            match = re.fullmatch(r"/api/projects/(\d+)/requirements", path)
            if method == "POST" and match:
                body = self._json_body()
                item_id = store.add_requirement(int(match[1]), body.get("number", ""), body.get("text", ""), body.get("source_page"))
                return self._send_json({"id": item_id}, 201)
            match = re.fullmatch(r"/api/projects/(\d+)/ocr", path)
            if method == "POST" and match:
                project_id = int(match[1])
                page = int(self._json_body()["page"])
                project = store.snapshot(project_id)
                if page not in project["unreadable_pages"] or not project["tor_path"] or not project["tor_filename"].lower().endswith(".pdf"):
                    raise ValueError("หน้านี้ไม่ใช่หน้า TOR ที่รอ OCR")
                cache = store.root / "cache"
                cache.mkdir(exist_ok=True)
                image = cache / f"tor-{project_id}-{page}-ocr.png"
                if not image.exists():
                    result = subprocess.run(
                        [_poppler(), "-f", str(page), "-l", str(page), "-scale-to", "1800", "-png", "-singlefile", project["tor_path"], str(image.with_suffix(""))],
                        capture_output=True, timeout=60, check=False,
                    )
                    if result.returncode or not image.exists():
                        raise RuntimeError("แสดงหน้า TOR สำหรับ OCR ไม่สำเร็จ")
                env = os.environ.copy()
                bundled_module = Path(sys.executable).resolve().parents[1] / "node" / "node_modules" / "tesseract.js"
                if bundled_module.exists() and not env.get("TOR_TESSERACT_MODULE"):
                    env["TOR_TESSERACT_MODULE"] = str(bundled_module)
                result = subprocess.run([_node(), str(HERE / "ocr.js"), str(image)], capture_output=True, text=True, timeout=90, env=env, check=False)
                if result.returncode:
                    raise RuntimeError("OCR ไม่สำเร็จ: " + (result.stderr.strip()[-250:] or "ตรวจ Node.js/Tesseract"))
                return self._send_json(json.loads(result.stdout))
            match = re.fullmatch(r"/api/projects/(\d+)/ocr/import", path)
            if method == "POST" and match:
                body = self._json_body()
                created = store.import_ocr_text(int(match[1]), int(body["page"]), str(body["text"]))
                return self._send_json({"created": created}, 201)
            match = re.fullmatch(r"/api/projects/(\d+)/products", path)
            if method == "POST" and match:
                body = self._json_body()
                item_id = store.add_product(int(match[1]), body.get("name", ""), body.get("model", ""))
                return self._send_json({"id": item_id}, 201)
            match = re.fullmatch(r"/api/projects/(\d+)/documents", path)
            if method == "POST" and match:
                form = self._multipart()
                if "file" not in form or not form["file"].filename:
                    raise ValueError("กรุณาเลือกเอกสาร PDF")
                product = form.getvalue("product_id", "")
                product_id = int(product) if product else None
                field = form["file"]
                item_id = store.add_document(int(match[1]), product_id, field.filename, field.file.read())
                return self._send_json({"id": item_id}, 201)
            match = re.fullmatch(r"/api/requirements/(\d+)", path)
            if method == "PATCH" and match:
                store.update_requirement(int(match[1]), self._json_body())
                return self._send_json({"ok": True})
            match = re.fullmatch(r"/api/requirements/(\d+)/evidence", path)
            if method == "POST" and match:
                body = self._json_body()
                item_id = store.add_evidence(
                    int(match[1]), int(body["document_id"]), int(body["pdf_page"]),
                    str(body.get("printed_page", "")), str(body.get("keyword", "")), body["box"],
                )
                return self._send_json({"id": item_id}, 201)
            match = re.fullmatch(r"/api/evidence/(\d+)", path)
            if method == "DELETE" and match:
                store.delete_evidence(int(match[1]))
                return self._send_json({"ok": True})
            match = re.fullmatch(r"/api/requirements/(\d+)/suggestions", path)
            if method == "GET" and match:
                return self._send_json(store.suggestions(int(match[1])))
            match = re.fullmatch(r"/api/documents/(\d+)/page/(\d+)/text", path)
            if method == "GET" and match:
                return self._send_json({"text": store.document_page_text(int(match[1]), int(match[2]))})
            match = re.fullmatch(r"/api/documents/(\d+)/page/(\d+)\.png", path)
            if method == "GET" and match:
                document_id, page = int(match[1]), int(match[2])
                info = store.document_info(document_id)
                if not 1 <= page <= info["page_count"]:
                    raise ValueError("เลขหน้า PDF ไม่ถูกต้อง")
                cache = store.root / "cache"
                cache.mkdir(exist_ok=True)
                image = cache / f"{document_id}-{page}.png"
                if not image.exists():
                    prefix = image.with_suffix("")
                    result = subprocess.run(
                        [_poppler(), "-f", str(page), "-l", str(page), "-scale-to", "1200", "-png", "-singlefile", info["stored_path"], str(prefix)],
                        capture_output=True, timeout=45, check=False,
                    )
                    if result.returncode or not image.exists():
                        raise RuntimeError("แสดงหน้า PDF ไม่สำเร็จ")
                return self._send_file(image, "image/png")
            match = re.fullmatch(r"/api/documents/(\d+)/file", path)
            if method == "GET" and match:
                info = store.document_info(int(match[1]))
                return self._send_file(Path(info["stored_path"]), "application/pdf")
            match = re.fullmatch(r"/api/projects/(\d+)/tor", path)
            if method == "GET" and match:
                info = store.snapshot(int(match[1]))
                if not info["tor_path"]:
                    raise ValueError("โครงการนี้ไม่มีไฟล์ TOR")
                content_type = "application/pdf" if info["tor_filename"].lower().endswith(".pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                return self._send_file(Path(info["tor_path"]), content_type)
            match = re.fullmatch(r"/api/projects/(\d+)/export\.xlsx", path)
            if method == "GET" and match:
                rows = store.export_rows(int(match[1]))
                with tempfile.NamedTemporaryFile(suffix=".xlsx", dir=store.root, delete=False) as temp:
                    target = Path(temp.name)
                try:
                    export_table(target, rows)
                    return self._send_file(target, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "comply-tor.xlsx")
                finally:
                    target.unlink(missing_ok=True)
            match = re.fullmatch(r"/api/documents/(\d+)/marked\.pdf", path)
            if method == "GET" and match:
                document_id = int(match[1])
                info = store.document_info(document_id)
                with tempfile.NamedTemporaryFile(suffix=".pdf", dir=store.root, delete=False) as temp:
                    target = Path(temp.name)
                try:
                    annotate_pdf(info["stored_path"], target, store.marks_for_document(document_id))
                    return self._send_file(target, "application/pdf", f"evidence-{document_id}-marked.pdf")
                finally:
                    target.unlink(missing_ok=True)
            return self._send_json({"error": "ไม่พบหน้าหรือคำสั่งนี้"}, 404)

        def _dispatch(self, method):
            try:
                if method != "GET":
                    self._check_origin()
                return self._handle(method)
            except PermissionError as exc:
                return self._send_json({"error": str(exc)}, 403)
            except (ValueError, KeyError, TypeError) as exc:
                return self._send_json({"error": str(exc)}, 400)
            except FileNotFoundError:
                return self._send_json({"error": "ไม่พบไฟล์"}, 404)
            except (RuntimeError, subprocess.TimeoutExpired) as exc:
                return self._send_json({"error": str(exc)}, 500)

        def do_GET(self):
            self._dispatch("GET")

        def do_POST(self):
            self._dispatch("POST")

        def do_PATCH(self):
            self._dispatch("PATCH")

        def do_DELETE(self):
            self._dispatch("DELETE")

    return ThreadingHTTPServer((host, port), Handler)


def main():
    parser = argparse.ArgumentParser(description="Local TOR comply app")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir", default=str(Path(os.environ.get("LOCALAPPDATA", Path.home())) / "TORComply"))
    args = parser.parse_args()
    server = make_server("127.0.0.1", args.port, Store(args.data_dir))
    print(f"TOR Comply running at http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

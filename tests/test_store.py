import tempfile
import unittest
from pathlib import Path

from reportlab.pdfgen import canvas

from store import Store


class StoreTests(unittest.TestCase):
    def test_project_can_go_from_tor_to_reviewed_evidence_and_export_rows(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp) / "data"
            tor = Path(temp) / "tor.pdf"
            pdf = canvas.Canvas(str(tor))
            pdf.drawString(50, 750, "5.3 IPv6 Addressing")
            pdf.save()
            store = Store(data)
            project_id = store.create_project("โครงการทดสอบ", "tor.pdf", tor.read_bytes())
            snapshot = store.snapshot(project_id)
            requirement = snapshot["requirements"][0]
            self.assertEqual(requirement["number"], "5.3")
            self.assertEqual(requirement["source_page"], 1)

            product_id = store.add_product(project_id, "Router A", "Model 1")
            document_id = store.add_document(project_id, product_id, "technical.pdf", tor.read_bytes())
            store.update_requirement(requirement["id"], {"product_id": product_id, "proposal": "เสนอ Router A"})
            store.add_evidence(requirement["id"], document_id, 1, "1", "IPv6 Addressing", [0.07, 0.07, 0.3, 0.04])
            store.update_requirement(requirement["id"], {"comparison": "ตรงตามข้อกำหนด"})

            rows = store.export_rows(project_id)
            self.assertEqual(rows[0]["comparison"], "ตรงตามข้อกำหนด")
            self.assertEqual(rows[0]["evidence"][0]["printed_page"], "1")

    def test_pass_judgment_requires_proposal_and_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(Path(temp) / "data")
            project_id = store.create_project("Manual TOR", None, None)
            requirement_id = store.add_requirement(project_id, "1.1", "ต้องมี IPv6", 2)
            with self.assertRaisesRegex(ValueError, "หลักฐาน"):
                store.update_requirement(requirement_id, {"comparison": "ตรงตามข้อกำหนด"})

    def test_ocr_text_is_imported_as_pending_review_for_scanned_page(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "scan.pdf"
            pdf = canvas.Canvas(str(source))
            pdf.rect(20, 20, 100, 100)
            pdf.save()
            store = Store(Path(temp) / "data")
            project_id = store.create_project("Scan", "scan.pdf", source.read_bytes())
            self.assertEqual(store.snapshot(project_id)["unreadable_pages"], [1])

            created = store.import_ocr_text(project_id, 1, "5.3 รองรับ IPv6 Addressing")

            snapshot = store.snapshot(project_id)
            self.assertEqual(created, 1)
            self.assertEqual(snapshot["unreadable_pages"], [])
            self.assertEqual(snapshot["ocr_pages"], [1])
            self.assertEqual(snapshot["requirements"][0]["source_method"], "ocr")
            self.assertEqual(snapshot["requirements"][0]["comparison"], "รอตรวจสอบ")

    def test_changing_product_or_removing_evidence_reopens_pass_judgment(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "evidence.pdf"
            pdf = canvas.Canvas(str(source))
            pdf.drawString(50, 700, "IPv6")
            pdf.save()
            store = Store(Path(temp) / "data")
            project_id = store.create_project("Project", None, None)
            requirement_id = store.add_requirement(project_id, "5.3", "IPv6")
            first_product = store.add_product(project_id, "Router A")
            second_product = store.add_product(project_id, "Router B")
            document_id = store.add_document(project_id, first_product, "evidence.pdf", source.read_bytes())
            evidence_id = store.add_evidence(requirement_id, document_id, 1, "1", "IPv6", [0.05, 0.1, 0.2, 0.04])
            store.update_requirement(requirement_id, {"product_id": first_product, "proposal": "เสนอ Router A", "comparison": "ตรงตามข้อกำหนด"})

            store.update_requirement(requirement_id, {"product_id": second_product})
            self.assertEqual(store.snapshot(project_id)["requirements"][0]["comparison"], "รอตรวจสอบ")
            with self.assertRaisesRegex(ValueError, "สินค้า"):
                store.update_requirement(requirement_id, {"comparison": "ตรงตามข้อกำหนด"})

            store.update_requirement(requirement_id, {"product_id": first_product, "comparison": "ตรงตามข้อกำหนด"})
            store.delete_evidence(evidence_id)
            self.assertEqual(store.snapshot(project_id)["requirements"][0]["comparison"], "รอตรวจสอบ")


if __name__ == "__main__":
    unittest.main()

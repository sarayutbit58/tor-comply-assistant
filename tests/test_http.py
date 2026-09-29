import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app import make_server
from store import Store


class HttpTests(unittest.TestCase):
    def test_server_refuses_network_binding_without_authentication(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "loopback"):
                make_server("0.0.0.0", 0, Store(Path(temp) / "data"))

    def test_local_api_creates_and_reads_project_without_external_services(self):
        with tempfile.TemporaryDirectory() as temp:
            server = make_server("127.0.0.1", 0, Store(Path(temp) / "data"))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}"
            try:
                response = urlopen(base + "/").read().decode("utf-8")
                self.assertIn("TOR Comply", response)
                request = Request(base + "/api/projects", data=json.dumps({"name": "Test"}).encode(), headers={"Content-Type": "application/json"})
                project_id = json.load(urlopen(request))["id"]
                snapshot = json.load(urlopen(base + f"/api/projects/{project_id}"))
                self.assertEqual(snapshot["name"], "Test")
                self.assertEqual(snapshot["requirements"], [])
                bad = Request(base + f"/api/projects/{project_id}/requirements", data=b"{}", headers={"Content-Type": "application/json"})
                with self.assertRaises(HTTPError) as error:
                    urlopen(bad)
                self.assertEqual(error.exception.code, 400)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()

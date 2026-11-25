import os
import unittest
from fastapi.testclient import TestClient

os.environ["FISCAL_ANALYSIS_TOKEN"] = "test-token-for-local-tests"
from main import app

class AnalysisServiceTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_liveness(self):
        response = self.client.get("/health/live")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_requires_token(self):
        response = self.client.post("/v1/extract/metadata", json={"content": "document"})
        self.assertEqual(response.status_code, 401)

    def test_integrity_metadata(self):
        response = self.client.post(
            "/v1/extract/metadata",
            headers={"Authorization": "Bearer test-token-for-local-tests"},
            json={"content": "line 1\r\nline 2"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["line_count"], 2)
        self.assertEqual(response.json()["legal_interpretation"], "NOT_PERFORMED")

if __name__ == "__main__":
    unittest.main()

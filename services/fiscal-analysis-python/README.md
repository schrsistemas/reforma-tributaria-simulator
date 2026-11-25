# Fiscal Analysis Service

Auxiliary Python 3.12 / FastAPI service.

The initial endpoint normalizes line endings and returns SHA-256 and text-size metadata. It intentionally does not perform legal interpretation, tax classification, tax calculation, or rule publication.

Run locally:

pip install -r requirements.txt
export FISCAL_ANALYSIS_TOKEN='a-long-private-token'
uvicorn main:app --host 127.0.0.1 --port 8090

Tests:

python -m unittest -v test_main.py

Keep this service on a private network. The API token is required for the metadata endpoint. Do not expose port 8090 publicly.

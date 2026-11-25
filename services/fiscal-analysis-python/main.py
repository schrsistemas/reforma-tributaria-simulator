"""Auxiliary metadata service. It does not interpret law or calculate taxes."""
from __future__ import annotations
import hashlib
import os
import secrets
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Fiscal Hub Analysis Service", version="0.1.0")
SERVICE_TOKEN = os.getenv("FISCAL_ANALYSIS_TOKEN", "")

class TextPayload(BaseModel):
    content: str = Field(min_length=1, max_length=2_000_000)

@app.get("/health/live")
def live() -> dict[str, bool]:
    return {"ok": True}

@app.post("/v1/extract/metadata")
def extract_metadata(payload: TextPayload, authorization: str | None = Header(default=None)) -> dict[str, object]:
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="SERVICE_TOKEN_NOT_CONFIGURED")
    if authorization is None or not secrets.compare_digest(authorization, f"Bearer {SERVICE_TOKEN}"):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    normalized = payload.content.replace("\r\n", "\n").replace("\r", "\n")
    encoded = normalized.encode("utf-8")
    return {
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "byte_length": len(encoded),
        "character_length": len(normalized),
        "line_count": normalized.count("\n") + 1,
        "normalization": "CRLF_AND_CR_TO_LF",
        "legal_interpretation": "NOT_PERFORMED"
    }

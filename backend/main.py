"""TekstOntleder backend: loads example.ljson (or the nested variant), validates it against the
LJSONDocument model and serves it over a small REST API. Uploaded documents are validated the
same way and echoed back; nothing is stored. Every response adds an integrity check of
`document_hash` against the text."""

import json
import sys
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from LJSONDocument import LJSONDocument  # noqa: E402

from backend.integrity import Integrity, check_integrity  # noqa: E402

# Fixed allowlist: the variant name never becomes part of a path.
DOCUMENTS = {
    "example": ROOT / "example.ljson",
    "nested": ROOT / "example_nested.ljson",
}

# Generous for a text document, small enough that validation stays instant.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

app = FastAPI(title="TekstOntleder API", version="0.1.0")

# The Vite dev server proxies /api, so CORS only matters when the frontend
# is served from elsewhere during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180", "http://127.0.0.1:5180"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class DocumentResponse(LJSONDocument):
    """The document as stored, plus what the server found when checking it."""

    integrity: Integrity


def with_integrity(doc: LJSONDocument) -> DocumentResponse:
    return DocumentResponse(**dict(doc), integrity=check_integrity(doc.text, doc.document_hash))


@lru_cache(maxsize=len(DOCUMENTS))
def load_document(variant: str) -> LJSONDocument:
    return LJSONDocument.model_validate_json(DOCUMENTS[variant].read_text(encoding="utf-8"))


def invalid_document(name: str, exc: ValidationError) -> HTTPException:
    # Round-trip through Pydantic's own JSON: ctx can hold exceptions, and the input can be bytes
    # or the whole upload, so it is left out.
    errors = json.loads(exc.json(include_url=False, include_input=False))
    return HTTPException(
        status_code=422,
        detail={"message": f"{name} voldoet niet aan het LJSON-schema", "errors": errors},
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/document", response_model=DocumentResponse)
def get_document(variant: Literal["example", "nested"] = "example") -> DocumentResponse:
    name = DOCUMENTS[variant].name
    try:
        return with_integrity(load_document(variant))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{name} niet gevonden")
    except ValidationError as exc:
        raise invalid_document(name, exc)


@app.post("/api/document", response_model=DocumentResponse)
async def validate_document(request: Request) -> DocumentResponse:
    """Validates an uploaded LJSON document and returns it as the GET endpoint would."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Het bestand is groter dan 5 MB")
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Het bestand is groter dan 5 MB")
    try:
        doc = LJSONDocument.model_validate_json(bytes(body))
    except ValidationError as exc:
        raise invalid_document("Het bestand", exc)
    return with_integrity(doc)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8010, reload="--dev" in sys.argv)

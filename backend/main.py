"""TekstOntleder backend: loads example.ljson (or the nested variant), validates it against the
LJSONDocument model and serves it over a small REST API."""

import sys
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from LJSONDocument import LJSONDocument  # noqa: E402

# Fixed allowlist: the variant name never becomes part of a path.
DOCUMENTS = {
    "example": ROOT / "example.ljson",
    "nested": ROOT / "example_nested.ljson",
}

app = FastAPI(title="TekstOntleder API", version="0.1.0")

# The Vite dev server proxies /api, so CORS only matters when the frontend
# is served from elsewhere during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180", "http://127.0.0.1:5180"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache(maxsize=len(DOCUMENTS))
def load_document(variant: str) -> LJSONDocument:
    return LJSONDocument.model_validate_json(DOCUMENTS[variant].read_text(encoding="utf-8"))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/document", response_model=LJSONDocument)
def get_document(variant: Literal["example", "nested"] = "example") -> LJSONDocument:
    name = DOCUMENTS[variant].name
    try:
        return load_document(variant)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{name} niet gevonden")
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"message": f"{name} voldoet niet aan het LJSON-schema", "errors": exc.errors(include_url=False)},
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8010, reload="--dev" in sys.argv)

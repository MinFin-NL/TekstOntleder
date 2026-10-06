import json

import pytest
from fastapi.testclient import TestClient

from backend.main import MAX_UPLOAD_BYTES, ROOT, app

client = TestClient(app)


def test_document_is_served_and_valid():
    res = client.get("/api/document")
    assert res.status_code == 200
    body = res.json()
    assert body["document_id"] == "doc_minfin_4091a"
    assert {s["source_type"] for s in body["provenance_spans"]} == {"human", "ai", "copied"}
    for span in body["provenance_spans"]:
        assert 0 <= span["start_idx"] <= span["end_idx"] <= len(body["text"])
    assert body["integrity"]["status"] == "match"


def test_nested_variant_has_contained_spans():
    res = client.get("/api/document", params={"variant": "nested"})
    assert res.status_code == 200
    spans = res.json()["provenance_spans"]
    assert any(
        o is not i and o["start_idx"] <= i["start_idx"] and i["end_idx"] <= o["end_idx"]
        for o in spans
        for i in spans
    )


def test_unknown_variant_is_rejected():
    assert client.get("/api/document", params={"variant": "../etc/passwd"}).status_code == 422


def test_uploaded_document_is_validated_and_echoed():
    body = (ROOT / "example_nested.ljson").read_bytes()
    res = client.post("/api/document", content=body, headers={"content-type": "application/json"})
    assert res.status_code == 200
    assert res.json() == client.get("/api/document", params={"variant": "nested"}).json()


@pytest.mark.parametrize(
    ("body", "error_type"),
    [
        (b"{not json", "json_invalid"),
        (b'{"document_id": "x"}', "missing"),
    ],
)
def test_invalid_upload_lists_errors(body, error_type):
    res = client.post("/api/document", content=body)
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["message"] == "Het bestand voldoet niet aan het LJSON-schema"
    assert error_type in {e["type"] for e in detail["errors"]}


def test_upload_with_crossing_spans_is_rejected():
    doc = json.loads((ROOT / "example.ljson").read_text(encoding="utf-8"))
    doc["provenance_spans"][1]["start_idx"] = 100  # crosses span 0, which ends at 128
    res = client.post("/api/document", json=doc)
    assert res.status_code == 422
    [error] = res.json()["detail"]["errors"]
    assert error["type"] == "span_overlap"
    assert error["ctx"]["index"] == 1 and error["ctx"]["other_index"] == 0


def test_oversized_upload_is_rejected():
    res = client.post("/api/document", content=b" " * (MAX_UPLOAD_BYTES + 1))
    assert res.status_code == 413


def test_upload_with_edited_text_reports_mismatch():
    doc = json.loads((ROOT / "example.ljson").read_text(encoding="utf-8"))
    doc["text"] = doc["text"].replace("veilige", "onveilige")
    res = client.post("/api/document", json=doc)
    assert res.status_code == 200
    integrity = res.json()["integrity"]
    assert integrity["status"] == "mismatch"
    assert integrity["computed_hash"] != doc["document_hash"]

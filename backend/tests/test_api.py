from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_document_is_served_and_valid():
    res = client.get("/api/document")
    assert res.status_code == 200
    body = res.json()
    assert body["document_id"] == "doc_minfin_4091a"
    assert {s["source_type"] for s in body["provenance_spans"]} == {"human", "ai", "copied"}
    for span in body["provenance_spans"]:
        assert 0 <= span["start_idx"] <= span["end_idx"] <= len(body["text"])


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

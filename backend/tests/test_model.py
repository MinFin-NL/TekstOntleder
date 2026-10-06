import pytest
from pydantic import ValidationError

from LJSONDocument import LJSONDocument

HUMAN = {
    "author_name": "Test",
    "author_email": "test@example.nl",
    "timestamp": "2026-10-06T08:00:00Z",
}


def doc(text: str, *ranges: tuple[int, int]) -> dict:
    return {
        "document_id": "doc_test",
        "document_hash": "0",
        "text": text,
        "provenance_spans": [
            {"start_idx": s, "end_idx": e, "source_type": "human", "metadata": HUMAN} for s, e in ranges
        ],
    }


@pytest.mark.parametrize(
    "ranges",
    [
        [(0, 3), (5, 8)],  # side by side
        [(0, 3), (3, 6)],  # touching
        [(0, 10), (2, 4), (4, 9)],  # nested siblings
        [(2, 6), (2, 6)],  # identical
        [(0, 10), (2, 8), (3, 5)],  # deep nesting
    ],
)
def test_valid_layouts(ranges):
    LJSONDocument.model_validate(doc("abcdefghij", *ranges))


@pytest.mark.parametrize(
    ("ranges", "message"),
    [
        ([(-1, 3)], "greater than or equal to 0"),
        ([(4, 4)], "must be greater than start_idx"),
        ([(5, 3)], "must be greater than start_idx"),
        ([(0, 11)], "exceeds text length"),
        ([(0, 5), (3, 8)], "partially overlaps"),
        ([(0, 10), (2, 5), (4, 7)], "partially overlaps"),
    ],
)
def test_invalid_layouts(ranges, message):
    with pytest.raises(ValidationError, match=message):
        LJSONDocument.model_validate(doc("abcdefghij", *ranges))


def test_indexes_count_code_points():
    # Five code points, seven UTF-16 units: the last character ends at index 5.
    text = "a😀b𝔸c"
    LJSONDocument.model_validate(doc(text, (0, 5)))
    with pytest.raises(ValidationError, match="exceeds text length"):
        LJSONDocument.model_validate(doc(text, (0, 6)))

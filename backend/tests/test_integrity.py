import hashlib

import pytest

from backend.integrity import check_integrity, text_hash


def test_hash_is_sha256_of_utf8_text():
    assert text_hash("Tekst met 😀") == hashlib.sha256("Tekst met 😀".encode("utf-8")).hexdigest()


@pytest.mark.parametrize(
    ("stored", "status"),
    [
        (text_hash("abc"), "match"),
        (text_hash("abc").upper(), "match"),
        (f"  {text_hash('abc')}\n", "match"),
        (text_hash("abd"), "mismatch"),
        ("b4e8f1c3d9a7h5j2k4l6", "unknown_format"),
        ("", "unknown_format"),
        (text_hash("abc")[:-1], "unknown_format"),
    ],
)
def test_status(stored, status):
    result = check_integrity("abc", stored)
    assert result.status == status
    assert result.computed_hash == text_hash("abc")

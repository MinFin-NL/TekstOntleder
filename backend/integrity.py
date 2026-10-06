"""Checks a document's `document_hash` against its text.

The hash is SHA-256 over the UTF-8 bytes of `text`, written as 64 hex characters. A hash stored
in the document itself shows that the text has not changed since the hash was taken; it does not
show who took it. Anyone who edits the text can also recompute the hash, so this catches
accidental changes and text edited without updating its provenance, not deliberate tampering.
"""

import hashlib
import re
from typing import Literal

from pydantic import BaseModel

SHA256_HEX = re.compile(r"[0-9a-fA-F]{64}")


class Integrity(BaseModel):
    algorithm: Literal["sha256"] = "sha256"
    computed_hash: str
    # match: stored hash equals the computed one. mismatch: both are SHA-256, the text differs.
    # unknown_format: the stored value is not a SHA-256 hex digest, so nothing can be compared.
    status: Literal["match", "mismatch", "unknown_format"]


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_integrity(text: str, document_hash: str) -> Integrity:
    computed = text_hash(text)
    stored = document_hash.strip()
    if not SHA256_HEX.fullmatch(stored):
        status = "unknown_format"
    elif stored.lower() == computed:
        status = "match"
    else:
        status = "mismatch"
    return Integrity(computed_hash=computed, status=status)

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


# --- Metadata Schemas ---

class HumanMetadata(BaseModel):
    author_name: str
    author_email: str
    department: Optional[str] = None
    typing_speed_wpm: Optional[int] = None
    timestamp: datetime


class AIMetadata(BaseModel):
    model_identifier: str
    trigger_agent: str
    invoked_by: Optional[str] = None
    parameters: Dict[str, Any]
    prompt_hash: str
    generation_time_ms: Optional[int] = None
    timestamp: datetime


class CopiedMetadata(BaseModel):
    original_doc_name: str
    original_doc_hash: str
    original_start_idx: int
    copied_by_name: str
    copied_by_email: str
    timestamp: datetime


# --- Span Schemas ---

class BaseSpan(BaseModel):
    start_idx: int
    end_idx: int


class HumanSpan(BaseSpan):
    source_type: Literal["human"]
    metadata: HumanMetadata


class AISpan(BaseSpan):
    source_type: Literal["ai"]
    metadata: AIMetadata


class CopiedSpan(BaseSpan):
    source_type: Literal["copied"]
    metadata: CopiedMetadata


# --- The Discriminated Union ---
# Pydantic will check the 'source_type' field first,
# then route validation to the specific class above.

ProvenanceSpan = Annotated[
    Union[HumanSpan, AISpan, CopiedSpan],
    Field(discriminator="source_type")
]


# --- Root Document Schema ---

class LJSONDocument(BaseModel):
    document_id: str
    format_version: str = "LJSON_1.0"
    document_hash: str
    text: str
    provenance_spans: List[ProvenanceSpan]

    # Optional: Add a validator to ensure spans don't exceed text length
    from pydantic import model_validator

    @model_validator(mode='after')
    def check_span_bounds(self) -> 'LJSONDocument':
        text_length = len(self.text)
        for span in self.provenance_spans:
            if span.end_idx > text_length:
                raise ValueError(
                    f"Span end_idx ({span.end_idx}) exceeds text length ({text_length})"
                )
        return self
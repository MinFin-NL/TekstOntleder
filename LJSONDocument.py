from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator
from pydantic_core import PydanticCustomError


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
    # Indexes count Unicode code points (Python str), end exclusive.
    start_idx: int = Field(ge=0)
    end_idx: int

    @model_validator(mode='after')
    def check_order(self) -> 'BaseSpan':
        if self.end_idx <= self.start_idx:
            raise PydanticCustomError(
                'span_order',
                'Span end_idx ({end_idx}) must be greater than start_idx ({start_idx})',
                {'start_idx': self.start_idx, 'end_idx': self.end_idx},
            )
        return self


class HumanSpan(BaseSpan):
    source_type: Literal["human"]
    metadata: HumanMetadata


class AISpan(BaseSpan):
    source_type: Literal["ai"]
    metadata: AIMetadata


class CopiedSpan(BaseSpan):
    source_type: Literal["copied"]
    metadata: CopiedMetadata

# Pydantic will check the 'source_type' field first,
# then route validation to the specific class above.

ProvenanceSpan = Annotated[
    Union[HumanSpan, AISpan, CopiedSpan],
    Field(discriminator="source_type")
]


class LJSONDocument(BaseModel):
    document_id: str
    format_version: str = "LJSON_1.0"
    document_hash: str
    text: str
    provenance_spans: List[ProvenanceSpan]

    @model_validator(mode='after')
    def check_span_bounds(self) -> 'LJSONDocument':
        text_length = len(self.text)
        for i, span in enumerate(self.provenance_spans):
            if span.end_idx > text_length:
                raise PydanticCustomError(
                    'span_bounds',
                    'Span {index}: end_idx ({end_idx}) exceeds text length ({text_length})',
                    {'index': i, 'end_idx': span.end_idx, 'text_length': text_length},
                )
        return self

    @model_validator(mode='after')
    def check_no_partial_overlap(self) -> 'LJSONDocument':
        # Spans may nest or sit side by side, but never cross: LJSON 1.0 has no
        # meaning for text that belongs to two sources neither of which contains the other.
        ordered = sorted(
            enumerate(self.provenance_spans), key=lambda item: (item[1].start_idx, -item[1].end_idx)
        )
        open_spans: List[tuple[int, BaseSpan]] = []
        for i, span in ordered:
            while open_spans and open_spans[-1][1].end_idx <= span.start_idx:
                open_spans.pop()
            if open_spans and span.end_idx > open_spans[-1][1].end_idx:
                j, outer = open_spans[-1]
                raise PydanticCustomError(
                    'span_overlap',
                    'Span {index} [{start_idx}, {end_idx}) partially overlaps '
                    'span {other_index} [{other_start_idx}, {other_end_idx})',
                    {
                        'index': i, 'start_idx': span.start_idx, 'end_idx': span.end_idx,
                        'other_index': j, 'other_start_idx': outer.start_idx, 'other_end_idx': outer.end_idx,
                    },
                )
            open_spans.append((i, span))
        return self

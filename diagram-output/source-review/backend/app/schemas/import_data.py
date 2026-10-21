from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ImportErrorDetail(BaseModel):
    row_number: int
    field: str
    message: str
    row_data: Dict[str, Any]


class ImportPreviewResponse(BaseModel):
    entity_type: str  # routes, stops, schedules, buses
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    errors: List[ImportErrorDetail]
    preview_data: List[Dict[str, Any]]
    is_ready_to_commit: bool


class ImportCommitRequest(BaseModel):
    entity_type: str
    data: List[Dict[str, Any]]


class ImportCommitResponse(BaseModel):
    entity_type: str
    inserted_count: int
    updated_count: int
    status: str
    message: str

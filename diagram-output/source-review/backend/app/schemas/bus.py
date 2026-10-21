from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BusBase(BaseModel):
    bus_code: str = Field(..., max_length=50, examples=["MOCK_BUS_001"])
    display_name: Optional[str] = Field(None, max_length=100, examples=["QC City Bus #101"])
    plate_number: Optional[str] = Field(None, max_length=50, examples=["NQA-1234"])
    capacity: Optional[int] = Field(50, ge=1, le=200)
    is_active: bool = True


class BusCreate(BusBase):
    pass


class BusUpdate(BaseModel):
    bus_code: Optional[str] = None
    display_name: Optional[str] = None
    plate_number: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class BusResponse(BusBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

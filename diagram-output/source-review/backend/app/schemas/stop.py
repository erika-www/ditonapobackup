from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class StopBase(BaseModel):
    stop_code: str = Field(..., max_length=50, examples=["MOCK_STOP_001"])
    stop_name: str = Field(..., max_length=150, examples=["Quezon City Hall Main Terminal"])
    address: Optional[str] = Field(None, max_length=255, examples=["Elliptical Road, Diliman, Quezon City"])
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, examples=[14.6460])
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, examples=[121.0503])
    data_source: str = Field("MOCK_QC_BUS", max_length=50)


class StopCreate(StopBase):
    pass


class StopUpdate(BaseModel):
    stop_code: Optional[str] = None
    stop_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    data_source: Optional[str] = None


class StopResponse(StopBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

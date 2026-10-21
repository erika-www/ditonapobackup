from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.stop import StopResponse


class RouteStopBase(BaseModel):
    stop_id: int
    stop_sequence: int
    estimated_travel_minutes: Optional[int] = None


class RouteStopCreate(RouteStopBase):
    pass


class RouteStopUpdate(BaseModel):
    stop_sequence: Optional[int] = None
    estimated_travel_minutes: Optional[int] = None


class RouteStopResponse(RouteStopBase):
    id: int
    route_id: int
    created_at: datetime
    updated_at: datetime
    stop: Optional[StopResponse] = None

    model_config = ConfigDict(from_attributes=True)


class StopSequenceItem(BaseModel):
    stop_id: int
    stop_sequence: int


class RouteStopReorderRequest(BaseModel):
    sequences: List[StopSequenceItem]

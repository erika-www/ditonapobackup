from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.bus import BusResponse
from app.schemas.route import RouteResponse


class TripBase(BaseModel):
    route_id: int
    bus_id: Optional[int] = None
    schedule_id: Optional[int] = None
    scheduled_departure: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    status: str = "SCHEDULED"  # SCHEDULED, IN_TRANSIT, COMPLETED, CANCELLED, DELAYED


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    bus_id: Optional[int] = None
    schedule_id: Optional[int] = None
    scheduled_departure: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    status: Optional[str] = None


class TripResponse(TripBase):
    id: int
    created_at: datetime
    updated_at: datetime
    route: Optional[RouteResponse] = None
    bus: Optional[BusResponse] = None

    model_config = ConfigDict(from_attributes=True)

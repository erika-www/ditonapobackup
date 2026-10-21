from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BusLocationBase(BaseModel):
    bus_id: Optional[int] = None
    trip_id: Optional[int] = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    speed: Optional[float] = None
    heading: Optional[float] = None
    is_simulated: bool = True
    source: str = "SIMULATION_ENGINE"
    recorded_at: datetime


class BusLocationCreate(BusLocationBase):
    pass


class BusLocationResponse(BusLocationBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

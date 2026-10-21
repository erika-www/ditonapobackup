from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.route_stop import RouteStopResponse


class RouteBase(BaseModel):
    route_code: str = Field(..., max_length=50, examples=["MOCK_ROUTE_001"])
    route_name: str = Field(..., max_length=150, examples=["QC Route 1: City Hall to Fairview"])
    description: Optional[str] = Field(None, examples=["Main arterial route serving North QC passengers."])
    is_active: bool = True
    data_source: str = Field("MOCK_QC_BUS", max_length=50)


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    route_code: Optional[str] = None
    route_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    data_source: Optional[str] = None


class RouteResponse(RouteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    stop_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class RouteDetailResponse(RouteResponse):
    route_stops: List[RouteStopResponse] = []

    model_config = ConfigDict(from_attributes=True)

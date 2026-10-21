from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


TIME_REGEX = r"^([01]\d|2[0-3]):[0-5]\d$"
ALLOWED_SERVICE_DAYS = ["DAILY", "WEEKDAY", "WEEKEND", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]


class ScheduleBase(BaseModel):
    route_id: int
    service_day: str = Field("DAILY", examples=["DAILY", "WEEKDAY", "WEEKEND"])
    departure_time: str = Field(..., pattern=TIME_REGEX, examples=["06:00", "07:30"])
    arrival_time: Optional[str] = Field(None, pattern=TIME_REGEX, examples=["07:30", "09:00"])
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: bool = True

    @field_validator("service_day")
    @classmethod
    def validate_service_day(cls, v: str) -> str:
        v_upper = v.upper().strip()
        if v_upper not in ALLOWED_SERVICE_DAYS:
            raise ValueError(f"Invalid service_day '{v}'. Must be one of: {', '.join(ALLOWED_SERVICE_DAYS)}")
        return v_upper


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    service_day: Optional[str] = None
    departure_time: Optional[str] = Field(None, pattern=TIME_REGEX)
    arrival_time: Optional[str] = Field(None, pattern=TIME_REGEX)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: Optional[bool] = None

    @field_validator("service_day")
    @classmethod
    def validate_service_day(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper().strip()
        if v_upper not in ALLOWED_SERVICE_DAYS:
            raise ValueError(f"Invalid service_day '{v}'. Must be one of: {', '.join(ALLOWED_SERVICE_DAYS)}")
        return v_upper


class ScheduleResponse(ScheduleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.models.base import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id", ondelete="CASCADE"), nullable=False, index=True)
    service_day = Column(String(50), nullable=False, default="DAILY")  # DAILY, WEEKDAY, WEEKEND, MONDAY, etc.
    departure_time = Column(String(20), nullable=False)  # HH:MM format e.g. "06:00"
    arrival_time = Column(String(20), nullable=True)  # HH:MM format e.g. "07:30"
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    route = relationship("Route", back_populates="schedules")
    trips = relationship("Trip", back_populates="schedule")

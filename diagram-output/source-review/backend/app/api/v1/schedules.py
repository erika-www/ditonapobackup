from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schedule import Schedule
from app.models.route import Route
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.api.v1.deps import get_current_admin

router = APIRouter()


@router.get("/route/{route_id}", response_model=List[ScheduleResponse], summary="List Schedules for Route")
def list_route_schedules(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route with ID {route_id} not found"
        )
    
    schedules = db.query(Schedule).filter(
        Schedule.route_id == route_id,
        Schedule.is_active == True
    ).order_by(Schedule.departure_time.asc()).all()
    
    return [ScheduleResponse.model_validate(s) for s in schedules]


@router.get("", response_model=List[ScheduleResponse], summary="List All Schedules")
def list_all_schedules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    schedules = db.query(Schedule).offset(skip).limit(limit).all()
    return [ScheduleResponse.model_validate(s) for s in schedules]


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED, summary="Create Schedule (Admin)")
def create_schedule(
    schedule_in: ScheduleCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    route = db.query(Route).filter(Route.id == schedule_in.route_id).first()
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route with ID {schedule_in.route_id} not found"
        )
    
    schedule = Schedule(**schedule_in.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return ScheduleResponse.model_validate(schedule)


@router.put("/{schedule_id}", response_model=ScheduleResponse, summary="Update Schedule (Admin)")
def update_schedule(
    schedule_id: int,
    schedule_in: ScheduleUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    
    update_data = schedule_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)
        
    db.commit()
    db.refresh(schedule)
    return ScheduleResponse.model_validate(schedule)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Schedule (Admin)")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    
    db.delete(schedule)
    db.commit()
    return None

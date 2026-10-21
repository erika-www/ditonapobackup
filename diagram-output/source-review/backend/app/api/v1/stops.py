from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.stop import Stop
from app.schemas.stop import StopCreate, StopUpdate, StopResponse
from app.api.v1.deps import get_current_admin

router = APIRouter()


@router.get("", response_model=List[StopResponse], summary="List and Search Stops")
def list_stops(
    q: Optional[str] = Query(None, description="Search query for stop code, name, or address"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Stop)
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (Stop.stop_code.ilike(search_pattern)) |
            (Stop.stop_name.ilike(search_pattern)) |
            (Stop.address.ilike(search_pattern))
        )
    
    stops = query.offset(skip).limit(limit).all()
    return [StopResponse.model_validate(s) for s in stops]


@router.get("/{stop_id}", response_model=StopResponse, summary="Get Stop Details")
def get_stop(stop_id: int, db: Session = Depends(get_db)):
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stop with ID {stop_id} not found"
        )
    return StopResponse.model_validate(stop)


@router.post("", response_model=StopResponse, status_code=status.HTTP_201_CREATED, summary="Create Stop (Admin)")
def create_stop(
    stop_in: StopCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    existing = db.query(Stop).filter(Stop.stop_code == stop_in.stop_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stop code '{stop_in.stop_code}' already exists"
        )
    
    stop = Stop(**stop_in.model_dump())
    db.add(stop)
    db.commit()
    db.refresh(stop)
    return StopResponse.model_validate(stop)


@router.put("/{stop_id}", response_model=StopResponse, summary="Update Stop (Admin)")
def update_stop(
    stop_id: int,
    stop_in: StopUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stop with ID {stop_id} not found"
        )
    
    update_data = stop_in.model_dump(exclude_unset=True)
    if "stop_code" in update_data and update_data["stop_code"] != stop.stop_code:
        conflict = db.query(Stop).filter(Stop.stop_code == update_data["stop_code"]).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stop code '{update_data['stop_code']}' is already in use"
            )
            
    for field, value in update_data.items():
        setattr(stop, field, value)
        
    db.commit()
    db.refresh(stop)
    return StopResponse.model_validate(stop)


@router.delete("/{stop_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Stop (Admin)")
def delete_stop(
    stop_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stop with ID {stop_id} not found"
        )
    
    db.delete(stop)
    db.commit()
    return None

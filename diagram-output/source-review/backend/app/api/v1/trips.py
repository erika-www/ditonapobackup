from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models.trip import Trip
from app.models.route import Route
from app.schemas.trip import TripCreate, TripUpdate, TripResponse
from app.api.v1.deps import get_current_admin

router = APIRouter()


@router.get("", response_model=List[TripResponse], summary="List and Filter Trips")
def list_trips(
    route_id: Optional[int] = Query(None, description="Filter by route ID"),
    status: Optional[str] = Query(None, description="Filter by trip status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Trip).options(
        joinedload(Trip.route),
        joinedload(Trip.bus)
    )
    if route_id:
        query = query.filter(Trip.route_id == route_id)
    if status:
        query = query.filter(Trip.status == status)
        
    trips = query.order_by(Trip.created_at.desc()).offset(skip).limit(limit).all()
    return [TripResponse.model_validate(t) for t in trips]


@router.get("/{trip_id}", response_model=TripResponse, summary="Get Trip Details")
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(Trip).options(
        joinedload(Trip.route),
        joinedload(Trip.bus)
    ).filter(Trip.id == trip_id).first()
    
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found"
        )
    return TripResponse.model_validate(trip)


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED, summary="Create Trip (Admin)")
def create_trip(
    trip_in: TripCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    route = db.query(Route).filter(Route.id == trip_in.route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route {trip_in.route_id} not found")
        
    trip = Trip(**trip_in.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    
    trip = db.query(Trip).options(
        joinedload(Trip.route),
        joinedload(Trip.bus)
    ).filter(Trip.id == trip.id).first()
    return TripResponse.model_validate(trip)


@router.put("/{trip_id}", response_model=TripResponse, summary="Update Trip Status / Details (Admin)")
def update_trip(
    trip_id: int,
    trip_in: TripUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip with ID {trip_id} not found")
        
    update_data = trip_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)
        
    db.commit()
    db.refresh(trip)
    
    trip = db.query(Trip).options(
        joinedload(Trip.route),
        joinedload(Trip.bus)
    ).filter(Trip.id == trip.id).first()
    return TripResponse.model_validate(trip)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Trip (Admin)")
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip with ID {trip_id} not found")
    db.delete(trip)
    db.commit()
    return None

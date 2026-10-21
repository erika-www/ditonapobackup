from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.bus import Bus
from app.schemas.bus import BusCreate, BusUpdate, BusResponse
from app.api.v1.deps import get_current_admin

router = APIRouter()


@router.get("", response_model=List[BusResponse], summary="List Bus Fleet")
def list_buses(
    q: Optional[str] = Query(None, description="Search code, name, or plate number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Bus)
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (Bus.bus_code.ilike(search_pattern)) |
            (Bus.display_name.ilike(search_pattern)) |
            (Bus.plate_number.ilike(search_pattern))
        )
    buses = query.offset(skip).limit(limit).all()
    return [BusResponse.model_validate(b) for b in buses]


@router.get("/{bus_id}", response_model=BusResponse, summary="Get Bus Details")
def get_bus(bus_id: int, db: Session = Depends(get_db)):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bus with ID {bus_id} not found"
        )
    return BusResponse.model_validate(bus)


@router.post("", response_model=BusResponse, status_code=status.HTTP_201_CREATED, summary="Create Bus (Admin)")
def create_bus(
    bus_in: BusCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    existing = db.query(Bus).filter(Bus.bus_code == bus_in.bus_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bus code '{bus_in.bus_code}' already exists"
        )
    
    bus = Bus(**bus_in.model_dump())
    db.add(bus)
    db.commit()
    db.refresh(bus)
    return BusResponse.model_validate(bus)


@router.put("/{bus_id}", response_model=BusResponse, summary="Update Bus (Admin)")
def update_bus(
    bus_id: int,
    bus_in: BusUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bus with ID {bus_id} not found"
        )
    
    update_data = bus_in.model_dump(exclude_unset=True)
    if "bus_code" in update_data and update_data["bus_code"] != bus.bus_code:
        conflict = db.query(Bus).filter(Bus.bus_code == update_data["bus_code"]).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bus code '{update_data['bus_code']}' is already used"
            )
            
    for field, value in update_data.items():
        setattr(bus, field, value)
        
    db.commit()
    db.refresh(bus)
    return BusResponse.model_validate(bus)


@router.delete("/{bus_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Bus (Admin)")
def delete_bus(
    bus_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bus with ID {bus_id} not found"
        )
    db.delete(bus)
    db.commit()
    return None

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.models.route import Route
from app.models.stop import Stop
from app.models.route_stop import RouteStop
from app.schemas.route import RouteCreate, RouteUpdate, RouteResponse, RouteDetailResponse
from app.schemas.route_stop import RouteStopCreate, RouteStopResponse, RouteStopReorderRequest
from app.api.v1.deps import get_current_admin

router = APIRouter()


@router.get("", response_model=List[RouteResponse], summary="List and Search Routes")
def list_routes(
    q: Optional[str] = Query(None, description="Search query for route code or name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Route)
    if is_active is not None:
        query = query.filter(Route.is_active == is_active)
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (Route.route_code.ilike(search_pattern)) |
            (Route.route_name.ilike(search_pattern)) |
            (Route.description.ilike(search_pattern))
        )
    
    routes = query.offset(skip).limit(limit).all()
    
    # Attach stop counts
    results = []
    for r in routes:
        count = db.query(func.count(RouteStop.id)).filter(RouteStop.route_id == r.id).scalar()
        r_resp = RouteResponse.model_validate(r)
        r_resp.stop_count = count or 0
        results.append(r_resp)
        
    return results


@router.get("/{route_id}", response_model=RouteDetailResponse, summary="Get Route Details")
def get_route(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).options(
        joinedload(Route.route_stops).joinedload(RouteStop.stop)
    ).filter(Route.id == route_id).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route with ID {route_id} not found"
        )
    
    resp = RouteDetailResponse.model_validate(route)
    resp.stop_count = len(route.route_stops)
    return resp


@router.get("/{route_id}/stops", response_model=List[RouteStopResponse], summary="Get Ordered Stops for Route")
def get_route_stops(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route with ID {route_id} not found"
        )
    
    route_stops = db.query(RouteStop).options(
        joinedload(RouteStop.stop)
    ).filter(
        RouteStop.route_id == route_id
    ).order_by(RouteStop.stop_sequence.asc()).all()
    
    return [RouteStopResponse.model_validate(rs) for rs in route_stops]


@router.post("", response_model=RouteResponse, status_code=status.HTTP_201_CREATED, summary="Create Route (Admin)")
def create_route(
    route_in: RouteCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    existing = db.query(Route).filter(Route.route_code == route_in.route_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Route with code '{route_in.route_code}' already exists"
        )
    
    route = Route(**route_in.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    
    resp = RouteResponse.model_validate(route)
    resp.stop_count = 0
    return resp


@router.put("/{route_id}", response_model=RouteResponse, summary="Update Route (Admin)")
def update_route(
    route_id: int,
    route_in: RouteUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route with ID {route_id} not found"
        )
    
    update_data = route_in.model_dump(exclude_unset=True)
    if "route_code" in update_data and update_data["route_code"] != route.route_code:
        conflict = db.query(Route).filter(Route.route_code == update_data["route_code"]).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Route code '{update_data['route_code']}' is already used"
            )
            
    for field, value in update_data.items():
        setattr(route, field, value)
        
    db.commit()
    db.refresh(route)
    
    count = db.query(func.count(RouteStop.id)).filter(RouteStop.route_id == route.id).scalar()
    resp = RouteResponse.model_validate(route)
    resp.stop_count = count or 0
    return resp


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Route (Admin)")
def delete_route(
    route_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route with ID {route_id} not found"
        )
    
    db.delete(route)
    db.commit()
    return None


@router.post("/{route_id}/stops", response_model=RouteStopResponse, status_code=status.HTTP_201_CREATED, summary="Add Stop to Route Sequence (Admin)")
def add_stop_to_route(
    route_id: int,
    route_stop_in: RouteStopCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route {route_id} not found")
        
    stop = db.query(Stop).filter(Stop.id == route_stop_in.stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail=f"Stop {route_stop_in.stop_id} not found")
        
    # Check duplicate sequence
    existing_seq = db.query(RouteStop).filter(
        RouteStop.route_id == route_id,
        RouteStop.stop_sequence == route_stop_in.stop_sequence
    ).first()
    
    if existing_seq:
        raise HTTPException(
            status_code=400,
            detail=f"Stop sequence number {route_stop_in.stop_sequence} is already occupied on this route"
        )
        
    rs = RouteStop(
        route_id=route_id,
        stop_id=route_stop_in.stop_id,
        stop_sequence=route_stop_in.stop_sequence,
        estimated_travel_minutes=route_stop_in.estimated_travel_minutes
    )
    db.add(rs)
    db.commit()
    db.refresh(rs)
    
    # Reload with stop relation
    rs = db.query(RouteStop).options(joinedload(RouteStop.stop)).filter(RouteStop.id == rs.id).first()
    return RouteStopResponse.model_validate(rs)


@router.put("/{route_id}/stops/reorder", response_model=List[RouteStopResponse], summary="Reorder Stops in Sequence (Admin)")
def reorder_route_stops(
    route_id: int,
    reorder_in: RouteStopReorderRequest,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route {route_id} not found")
        
    # Two-pass sequence update to prevent intermediate unique constraint collisions
    sequence_map = {item.stop_id: item.stop_sequence for item in reorder_in.sequences}
    route_stops = db.query(RouteStop).filter(RouteStop.route_id == route_id).all()
    
    # Phase 1: Set temporary negative sequence values to free up positive integers
    for rs in route_stops:
        if rs.stop_id in sequence_map:
            rs.stop_sequence = -rs.id
    db.flush()

    # Phase 2: Set target final sequence values
    for rs in route_stops:
        if rs.stop_id in sequence_map:
            rs.stop_sequence = sequence_map[rs.stop_id]
            
    db.commit()
    
    updated_stops = db.query(RouteStop).options(joinedload(RouteStop.stop)).filter(
        RouteStop.route_id == route_id
    ).order_by(RouteStop.stop_sequence.asc()).all()
    
    return [RouteStopResponse.model_validate(rs) for rs in updated_stops]


@router.delete("/{route_id}/stops/{stop_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove Stop from Route (Admin)")
def remove_stop_from_route(
    route_id: int,
    stop_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    rs = db.query(RouteStop).filter(
        RouteStop.route_id == route_id,
        RouteStop.stop_id == stop_id
    ).first()
    
    if not rs:
        raise HTTPException(
            status_code=404,
            detail=f"Stop ID {stop_id} is not associated with Route ID {route_id}"
        )
        
    db.delete(rs)
    db.commit()
    return None

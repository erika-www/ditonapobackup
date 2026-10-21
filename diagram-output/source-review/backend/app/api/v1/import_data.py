import io
import json
import pandas as pd
from typing import List, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.route import Route
from app.models.stop import Stop
from app.models.bus import Bus
from app.models.schedule import Schedule
from app.schemas.import_data import ImportPreviewResponse, ImportErrorDetail, ImportCommitRequest, ImportCommitResponse
from app.api.v1.deps import get_current_admin

router = APIRouter()


def validate_routes_data(df: pd.DataFrame, db: Session) -> Tuple[List[Dict[str, Any]], List[ImportErrorDetail]]:
    valid_rows = []
    errors = []
    
    required_cols = ["route_code", "route_name"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        errors.append(ImportErrorDetail(
            row_number=0,
            field="columns",
            message=f"Missing required columns: {', '.join(missing)}",
            row_data={}
        ))
        return valid_rows, errors
    
    existing_codes = set(code for (code,) in db.query(Route.route_code).all())
    seen_in_file = set()
    
    for idx, row in df.iterrows():
        row_num = idx + 1
        row_dict = row.to_dict()
        
        code = str(row_dict.get("route_code", "")).strip()
        name = str(row_dict.get("route_name", "")).strip()
        desc = str(row_dict.get("description", "")).strip() if pd.notna(row_dict.get("description")) else None
        
        if not code:
            errors.append(ImportErrorDetail(row_number=row_num, field="route_code", message="route_code cannot be empty", row_data=row_dict))
            continue
        if not name:
            errors.append(ImportErrorDetail(row_number=row_num, field="route_name", message="route_name cannot be empty", row_data=row_dict))
            continue
            
        if code in seen_in_file:
            errors.append(ImportErrorDetail(row_number=row_num, field="route_code", message=f"Duplicate route_code '{code}' in upload file", row_data=row_dict))
            continue
        seen_in_file.add(code)
        
        is_update = code in existing_codes
        valid_rows.append({
            "route_code": code,
            "route_name": name,
            "description": desc,
            "is_active": True,
            "data_source": "IMPORTED_DATASET",
            "_action": "UPDATE" if is_update else "INSERT"
        })
        
    return valid_rows, errors


def validate_stops_data(df: pd.DataFrame, db: Session) -> Tuple[List[Dict[str, Any]], List[ImportErrorDetail]]:
    valid_rows = []
    errors = []
    
    required_cols = ["stop_code", "stop_name"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        errors.append(ImportErrorDetail(row_number=0, field="columns", message=f"Missing required columns: {', '.join(missing)}", row_data={}))
        return valid_rows, errors
        
    existing_codes = set(code for (code,) in db.query(Stop.stop_code).all())
    seen_in_file = set()
    
    for idx, row in df.iterrows():
        row_num = idx + 1
        row_dict = row.to_dict()
        
        code = str(row_dict.get("stop_code", "")).strip()
        name = str(row_dict.get("stop_name", "")).strip()
        address = str(row_dict.get("address", "")).strip() if pd.notna(row_dict.get("address")) else None
        
        lat = None
        if pd.notna(row_dict.get("latitude")):
            try:
                lat = float(row_dict.get("latitude"))
                if lat < -90.0 or lat > 90.0:
                    errors.append(ImportErrorDetail(row_number=row_num, field="latitude", message=f"Invalid latitude {lat}", row_data=row_dict))
                    continue
            except ValueError:
                errors.append(ImportErrorDetail(row_number=row_num, field="latitude", message="Latitude must be numeric", row_data=row_dict))
                continue

        lng = None
        if pd.notna(row_dict.get("longitude")):
            try:
                lng = float(row_dict.get("longitude"))
                if lng < -180.0 or lng > 180.0:
                    errors.append(ImportErrorDetail(row_number=row_num, field="longitude", message=f"Invalid longitude {lng}", row_data=row_dict))
                    continue
            except ValueError:
                errors.append(ImportErrorDetail(row_number=row_num, field="longitude", message="Longitude must be numeric", row_data=row_dict))
                continue

        if not code or not name:
            errors.append(ImportErrorDetail(row_number=row_num, field="stop_code/stop_name", message="stop_code and stop_name are required", row_data=row_dict))
            continue
            
        if code in seen_in_file:
            errors.append(ImportErrorDetail(row_number=row_num, field="stop_code", message=f"Duplicate stop_code '{code}' in upload file", row_data=row_dict))
            continue
        seen_in_file.add(code)
        
        is_update = code in existing_codes
        valid_rows.append({
            "stop_code": code,
            "stop_name": name,
            "address": address,
            "latitude": lat,
            "longitude": lng,
            "data_source": "IMPORTED_DATASET",
            "_action": "UPDATE" if is_update else "INSERT"
        })
        
    return valid_rows, errors


@router.post("/preview", response_model=ImportPreviewResponse, summary="Preview & Validate Dataset Import (Admin)")
async def preview_import(
    entity_type: str = Form(..., description="Entity type: routes, stops, buses"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    entity_type = entity_type.lower().strip()
    if entity_type not in ["routes", "stops", "buses"]:
        raise HTTPException(status_code=400, detail=f"Unsupported entity type '{entity_type}'. Allowed: routes, stops, buses")

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowable limit of 5MB"
        )
    
    filename = file.filename.lower() if file.filename else ""
    if not (filename.endswith(".csv") or filename.endswith(".json")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv and .json file formats are supported"
        )
    
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(".json"):
            df = pd.read_json(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Only .csv and .json files are supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file format: {str(e)}")

    if entity_type == "routes":
        valid_data, errors = validate_routes_data(df, db)
    elif entity_type == "stops":
        valid_data, errors = validate_stops_data(df, db)
    else:
        valid_data, errors = [], []

    total_rows = len(df)
    return ImportPreviewResponse(
        entity_type=entity_type,
        total_rows=total_rows,
        valid_rows_count=len(valid_data),
        invalid_rows_count=len(errors),
        errors=errors,
        preview_data=valid_data,
        is_ready_to_commit=len(errors) == 0 and len(valid_data) > 0
    )


@router.post("/commit", response_model=ImportCommitResponse, summary="Commit Validated Dataset Import (Admin)")
def commit_import(
    request: ImportCommitRequest,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    entity_type = request.entity_type.lower().strip()
    inserted_count = 0
    updated_count = 0
    
    try:
        if entity_type == "routes":
            for item in request.data:
                action = item.pop("_action", None)
                code = item["route_code"]
                route = db.query(Route).filter(Route.route_code == code).first()
                if route:
                    for k, v in item.items():
                        setattr(route, k, v)
                    updated_count += 1
                else:
                    route = Route(**item)
                    db.add(route)
                    inserted_count += 1
        elif entity_type == "stops":
            for item in request.data:
                action = item.pop("_action", None)
                code = item["stop_code"]
                stop = db.query(Stop).filter(Stop.stop_code == code).first()
                if stop:
                    for k, v in item.items():
                        setattr(stop, k, v)
                    updated_count += 1
                else:
                    stop = Stop(**item)
                    db.add(stop)
                    inserted_count += 1
                    
        db.commit()
        return ImportCommitResponse(
            entity_type=entity_type,
            inserted_count=inserted_count,
            updated_count=updated_count,
            status="SUCCESS",
            message=f"Imported {inserted_count} new records and updated {updated_count} existing records successfully."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import commit failed: {str(e)}"
        )

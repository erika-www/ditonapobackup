from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()


@router.get("/health", summary="Basic API Health Check")
def health_check():
    return {
        "status": "healthy",
        "service": "DITO NA PO - QC Bus Backend API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/db", summary="Database Connectivity Check")
def db_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1;"))
        dialect_name = db.bind.dialect.name if db.bind else "unknown"
        return {
            "status": "connected",
            "database": dialect_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failure: {str(e)}"
        )

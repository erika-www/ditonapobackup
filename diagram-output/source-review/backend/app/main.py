from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.routes import router as routes_router
from app.api.v1.stops import router as stops_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.buses import router as buses_router
from app.api.v1.trips import router as trips_router
from app.api.v1.import_data import router as import_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend REST API for DITO NA PO - Quezon City Bus Information and Passenger Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Security Response Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS Middleware Setup
allowed_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [i.strip() for i in settings.CORS_ORIGINS.split(",") if i.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# Include API v1 Routers
app.include_router(health_router, prefix=settings.API_V1_STR, tags=["System Health"])
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(routes_router, prefix=f"{settings.API_V1_STR}/routes", tags=["Routes"])
app.include_router(stops_router, prefix=f"{settings.API_V1_STR}/stops", tags=["Stops"])
app.include_router(schedules_router, prefix=f"{settings.API_V1_STR}/schedules", tags=["Schedules"])
app.include_router(buses_router, prefix=f"{settings.API_V1_STR}/buses", tags=["Buses"])
app.include_router(trips_router, prefix=f"{settings.API_V1_STR}/trips", tags=["Trips"])
app.include_router(import_router, prefix=f"{settings.API_V1_STR}/import", tags=["Dataset Import"])


@app.get("/", tags=["Root"])
def read_root():
    return {
        "app": settings.PROJECT_NAME,
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
        "status": "online"
    }

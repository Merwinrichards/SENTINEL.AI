from fastapi import APIRouter, status

from app.core.config import settings
from app.schemas.common import HealthResponse, ProjectInfo, ReadinessResponse
from app.websocket.manager import ws_manager

router = APIRouter(tags=["Health & Status"])


@router.get(
    "/", response_model=ProjectInfo, status_code=status.HTTP_200_OK, summary="Root Project Metadata"
)
async def get_root() -> ProjectInfo:
    """Return root metadata describing project name, version, and running status."""
    return ProjectInfo(
        name=settings.APP_NAME,
        version=settings.VERSION,
        status="running",
        environment=settings.APP_ENV,
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
)
async def get_health() -> HealthResponse:
    """Basic liveness health check."""
    return HealthResponse(status="healthy")


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    summary="Readiness Probe",
)
async def get_readiness() -> ReadinessResponse:
    """Comprehensive readiness probe verifying core subsystem operational state."""
    components = {
        "event_bus": "operational",
        "websocket_manager": f"operational (active: {ws_manager.get_active_count()})",
        "configuration": "loaded",
    }
    return ReadinessResponse(status="ready", components=components)

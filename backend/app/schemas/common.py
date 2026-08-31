from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class ProjectInfo(BaseModel):
    """Metadata response for root endpoint GET /."""

    name: str = Field(default="SENTINEL AI")
    version: str = Field(default="0.1.0")
    status: str = Field(default="running")
    environment: str = Field(default="development")


class HealthResponse(BaseModel):
    """Liveness probe response for GET /health."""

    status: str = Field(default="healthy")


class ReadinessResponse(BaseModel):
    """Readiness probe response for GET /health/ready."""

    status: str = Field(default="ready")
    components: dict[str, str] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class APIResponse[T](BaseModel):
    """Standard generic API response envelope."""

    success: bool = True
    data: T | None = None
    message: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ErrorResponse(BaseModel):
    """Standard error response payload."""

    success: bool = False
    error: str
    detail: Any | None = None
    error_code: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    path: str | None = None


class WebSocketMessage(BaseModel):
    """Typed WebSocket message envelope for client/server communication."""

    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    correlation_id: str | None = None

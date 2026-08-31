import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.websocket import router as websocket_router
from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.events.bus import event_bus
from app.schemas.common import ErrorResponse

logger = get_logger("sentinel.app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for startup and shutdown routines."""
    setup_logging(settings.LOG_LEVEL)
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION} [{settings.APP_ENV}]")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")
    await event_bus.unsubscribe_all()


def create_app() -> FastAPI:
    """Application factory for SENTINEL AI FastAPI service."""
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        description="SENTINEL AI Real-Time AI Scam-Call Detection Backend Foundation",
        lifespan=lifespan,
    )

    # 1. Configure CORS
    allowed_origins = (
        settings.ALLOWED_ORIGINS
        if isinstance(settings.ALLOWED_ORIGINS, list)
        else [settings.ALLOWED_ORIGINS]
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Request Lifecycle Logging Middleware
    @application.middleware("http")
    async def request_lifecycle_middleware(request: Request, call_next):
        start_time = time.time()
        path = request.url.path
        method = request.method

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000
            logger.info(
                f"{method} {path} - Status: {response.status_code} - Duration: {duration_ms:.2f}ms"
            )
            return response
        except Exception as ex:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"{method} {path} failed after {duration_ms:.2f}ms: {ex}", exc_info=True)
            raise

    # 3. Global Exception Handlers
    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
        err = ErrorResponse(
            success=False,
            error="Validation Error",
            detail=exc.errors(),
            error_code="VALIDATION_FAILED",
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=err.model_dump()
        )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.info(
            f"HTTPException on {request.method} {request.url.path}: {exc.status_code} - {exc.detail}"
        )
        err = ErrorResponse(
            success=False,
            error=str(exc.detail),
            error_code=f"HTTP_{exc.status_code}",
            path=request.url.path,
        )
        return JSONResponse(status_code=exc.status_code, content=err.model_dump())

    @application.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True
        )
        detail_msg = str(exc) if settings.DEBUG else "Internal Server Error"
        err = ErrorResponse(
            success=False,
            error="Internal Server Error",
            detail=detail_msg,
            error_code="INTERNAL_SERVER_ERROR",
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=err.model_dump()
        )

    # 4. Include Routers
    application.include_router(health_router)
    application.include_router(websocket_router)

    return application


app = create_app()

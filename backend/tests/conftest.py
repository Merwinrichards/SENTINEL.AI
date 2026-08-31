import pytest
from fastapi.testclient import TestClient

from app.events.bus import event_bus
from app.main import create_app


@pytest.fixture
def app():
    """Create a fresh FastAPI app instance for testing."""
    return create_app()


@pytest.fixture
def client(app):
    """TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
async def clean_event_bus():
    """Ensure event bus is reset before each test."""
    await event_bus.unsubscribe_all()
    event_bus.clear_history()
    yield
    await event_bus.unsubscribe_all()
    event_bus.clear_history()

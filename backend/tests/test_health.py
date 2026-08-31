from fastapi import status
from fastapi.testclient import TestClient


def test_get_root_metadata(client: TestClient) -> None:
    """Test GET / returns project metadata."""
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "SENTINEL AI"
    assert data["version"] == "0.1.0"
    assert data["status"] == "running"
    assert "environment" in data


def test_get_health_liveness(client: TestClient) -> None:
    """Test GET /health returns healthy status."""
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"


def test_get_health_readiness(client: TestClient) -> None:
    """Test GET /health/ready returns ready status and components."""
    response = client.get("/health/ready")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ready"
    assert "components" in data
    assert "event_bus" in data["components"]
    assert "websocket_manager" in data["components"]
    assert "configuration" in data["components"]
    assert "timestamp" in data

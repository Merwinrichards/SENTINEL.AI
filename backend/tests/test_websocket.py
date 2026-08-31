import pytest
from fastapi.testclient import TestClient

from app.schemas.common import WebSocketMessage
from app.websocket.manager import ws_manager


def test_websocket_connect_receives_welcome(client: TestClient):
    """Test client connects and immediately receives CONNECTED envelope."""
    with client.websocket_connect("/ws") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "CONNECTED"
        assert "connection_id" in data["payload"]
        assert data["payload"]["status"] == "established"


def test_websocket_ping_pong_heartbeat(client: TestClient):
    """Test PING message returns PONG with correlation_id."""
    with client.websocket_connect("/ws") as websocket:
        # Read welcome message
        _ = websocket.receive_json()

        # Send PING
        websocket.send_json({"type": "PING", "payload": {}, "correlation_id": "test_ping_123"})

        response = websocket.receive_json()
        assert response["type"] == "PONG"
        assert response["payload"]["ack"] is True
        assert response["correlation_id"] == "test_ping_123"


def test_websocket_echo_message(client: TestClient):
    """Test ECHO message returns ECHO_RESPONSE with payload preserved."""
    with client.websocket_connect("/ws") as websocket:
        _ = websocket.receive_json()

        websocket.send_json(
            {"type": "ECHO", "payload": {"hello": "world"}, "correlation_id": "echo_corr_1"}
        )

        response = websocket.receive_json()
        assert response["type"] == "ECHO_RESPONSE"
        assert response["payload"]["hello"] == "world"
        assert response["correlation_id"] == "echo_corr_1"


def test_websocket_malformed_json_rejected(client: TestClient):
    """Test non-JSON string is safely rejected without crashing the connection."""
    with client.websocket_connect("/ws") as websocket:
        _ = websocket.receive_json()

        # Send raw non-JSON text
        websocket.send_text("THIS_IS_NOT_VALID_JSON{{{")

        response = websocket.receive_json()
        assert response["type"] == "ERROR"
        assert "Malformed JSON" in response["payload"]["detail"]


def test_websocket_invalid_schema_rejected(client: TestClient):
    """Test invalid message lacking required 'type' field is rejected."""
    with client.websocket_connect("/ws") as websocket:
        _ = websocket.receive_json()

        # Send JSON missing 'type'
        websocket.send_json({"no_type_field": "some_value"})

        response = websocket.receive_json()
        assert response["type"] == "ERROR"
        assert "Schema validation failed" in response["payload"]["detail"]


@pytest.mark.asyncio
async def test_websocket_manager_broadcast(client: TestClient):
    """Test WebSocketManager broadcast delivers message to multiple clients."""
    with client.websocket_connect("/ws") as ws1:
        _ = ws1.receive_json()

        with client.websocket_connect("/ws") as ws2:
            _ = ws2.receive_json()

            # Broadcast message via ws_manager
            test_broadcast = WebSocketMessage(
                type="SYSTEM_ALERT", payload={"level": "CRITICAL", "info": "broadcast_test"}
            )
            await ws_manager.broadcast(test_broadcast)

            msg1 = ws1.receive_json()
            msg2 = ws2.receive_json()

            assert msg1["type"] == "SYSTEM_ALERT"
            assert msg1["payload"]["info"] == "broadcast_test"
            assert msg2["type"] == "SYSTEM_ALERT"
            assert msg2["payload"]["info"] == "broadcast_test"


def test_websocket_disconnect_cleanup(client: TestClient):
    """Test client disconnecting removes connection from registry."""
    initial_count = ws_manager.get_active_count()

    with client.websocket_connect("/ws") as websocket:
        _ = websocket.receive_json()
        assert ws_manager.get_active_count() == initial_count + 1

    # After exiting context manager, client is disconnected
    assert ws_manager.get_active_count() == initial_count

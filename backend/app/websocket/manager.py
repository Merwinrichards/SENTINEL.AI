import asyncio
import json
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket

from app.core.logging import get_logger
from app.schemas.common import WebSocketMessage

logger = get_logger("sentinel.websocket")


class ConnectionMetadata:
    def __init__(self, connection_id: str, client_ip: str = "unknown") -> None:
        self.connection_id = connection_id
        self.client_ip = client_ip
        self.connected_at = time.time()
        self.last_ping_at = time.time()


class WebSocketManager:
    """
    Manages active WebSocket client connections, message broadcasting,
    heartbeats, and graceful disconnection.
    """

    def __init__(self) -> None:
        self._active_connections: dict[str, WebSocket] = {}
        self._connection_meta: dict[str, ConnectionMetadata] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str | None = None) -> str:
        """Accept WebSocket connection and register client."""
        await websocket.accept()
        connection_id = client_id or f"conn_{uuid.uuid4().hex[:12]}"

        client_ip = "unknown"
        if websocket.client:
            client_ip = f"{websocket.client.host}:{websocket.client.port}"

        async with self._lock:
            self._active_connections[connection_id] = websocket
            self._connection_meta[connection_id] = ConnectionMetadata(connection_id, client_ip)

        logger.info(
            f"WebSocket client connected: {connection_id} ({client_ip}). Total active: {len(self._active_connections)}"
        )

        # Send initial CONNECTED envelope
        connected_payload = WebSocketMessage(
            type="CONNECTED",
            payload={
                "connection_id": connection_id,
                "status": "established",
                "active_clients": len(self._active_connections),
                "server_time": datetime.now(UTC).isoformat(),
            },
        )
        await self.send_message(connection_id, connected_payload)
        return connection_id

    async def disconnect(self, connection_id: str) -> None:
        """Remove a client from active registry."""
        async with self._lock:
            if connection_id in self._active_connections:
                del self._active_connections[connection_id]
            if connection_id in self._connection_meta:
                del self._connection_meta[connection_id]

        logger.info(
            f"WebSocket client disconnected: {connection_id}. Remaining: {len(self._active_connections)}"
        )

    async def send_message(
        self, connection_id: str, message: dict[str, Any] | str | WebSocketMessage
    ) -> bool:
        """Send message to a specific connected client."""
        ws = self._active_connections.get(connection_id)
        if not ws:
            return False

        payload_str: str
        if isinstance(message, WebSocketMessage):
            payload_str = json.dumps(message.model_dump())
        elif isinstance(message, dict):
            payload_str = json.dumps(message)
        else:
            payload_str = str(message)

        try:
            await ws.send_text(payload_str)
            return True
        except Exception as ex:
            logger.warning(f"Failed to send message to {connection_id}: {ex}")
            await self.disconnect(connection_id)
            return False

    async def broadcast(self, message: dict[str, Any] | str | WebSocketMessage) -> None:
        """Broadcast message to all connected clients."""
        if not self._active_connections:
            return

        payload_str: str
        if isinstance(message, WebSocketMessage):
            payload_str = json.dumps(message.model_dump())
        elif isinstance(message, dict):
            payload_str = json.dumps(message)
        else:
            payload_str = str(message)

        async with self._lock:
            connections_snapshot = list(self._active_connections.items())

        stale_connections = []
        for conn_id, ws in connections_snapshot:
            try:
                await ws.send_text(payload_str)
            except Exception as ex:
                logger.warning(f"Error broadcasting to {conn_id}: {ex}")
                stale_connections.append(conn_id)

        for conn_id in stale_connections:
            await self.disconnect(conn_id)

    def get_active_count(self) -> int:
        """Return count of active connections."""
        return len(self._active_connections)

    def get_connection_ids(self) -> list[str]:
        """Return list of active connection IDs."""
        return list(self._active_connections.keys())


# Global singleton WebSocket manager
ws_manager = WebSocketManager()

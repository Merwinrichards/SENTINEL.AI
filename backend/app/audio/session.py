import time
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.audio.models import AudioCodec, SessionStatus, TransportAnomaly, TransportAnomalyType
from app.core.logging import get_logger

logger = get_logger("sentinel.audio.session")


class AudioSession(BaseModel):
    """
    State and transport accounting for an active audio stream / call.
    """

    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex[:12]}")
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    connection_id: str = ""
    start_time: float | None = None
    end_time: float | None = None
    status: SessionStatus = SessionStatus.CREATED
    audio_format: str = AudioCodec.WEBM_OPUS.value
    sample_rate: int = 16000
    channels: int = 1
    bytes_received: int = 0
    frame_count: int = 0
    dropped_frames: int = 0
    out_of_order_frames: int = 0
    expected_sequence: int = 0
    anomalies: list[TransportAnomaly] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    metadata: dict[str, Any] = Field(default_factory=dict)

    def transition_to(self, new_status: SessionStatus) -> None:
        """Execute valid session state transition."""
        logger.info(
            f"Session {self.session_id} state transition: {self.status.value} -> {new_status.value}"
        )
        self.status = new_status
        self.updated_at = datetime.now(UTC).isoformat()
        if new_status == SessionStatus.ACTIVE and self.start_time is None:
            self.start_time = time.time()
        elif new_status in (SessionStatus.ENDED, SessionStatus.ERROR):
            self.end_time = time.time()

    def record_frame(self, frame_size: int, sequence_number: int) -> None:
        """Record accepted frame metrics."""
        self.bytes_received += frame_size
        self.frame_count += 1
        self.expected_sequence = sequence_number + 1
        self.updated_at = datetime.now(UTC).isoformat()

    def record_anomaly(
        self, anomaly_type: TransportAnomalyType, received_seq: int, details: str = ""
    ) -> TransportAnomaly:
        """Record transport sequence anomaly."""
        anomaly = TransportAnomaly(
            anomaly_type=anomaly_type,
            expected_sequence=self.expected_sequence,
            received_sequence=received_seq,
            details=details,
        )
        self.anomalies.append(anomaly)
        if anomaly_type == TransportAnomalyType.OUT_OF_ORDER:
            self.out_of_order_frames += 1
        elif anomaly_type == TransportAnomalyType.QUEUE_OVERFLOW:
            self.dropped_frames += 1
        self.updated_at = datetime.now(UTC).isoformat()
        return anomaly


class SessionManager:
    """
    Thread-safe registry of active audio sessions mapped by session ID and WebSocket connection.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, AudioSession] = {}
        self._connection_to_session: dict[str, str] = {}

    def create_session(
        self,
        connection_id: str,
        correlation_id: str | None = None,
        audio_format: str = AudioCodec.WEBM_OPUS.value,
        sample_rate: int = 16000,
        channels: int = 1,
        metadata: dict[str, Any] | None = None,
    ) -> AudioSession:
        """Create and register a new AudioSession for a connection."""
        session = AudioSession(
            connection_id=connection_id,
            correlation_id=correlation_id or str(uuid.uuid4()),
            audio_format=audio_format,
            sample_rate=sample_rate,
            channels=channels,
            metadata=metadata or {},
        )
        self._sessions[session.session_id] = session
        self._connection_to_session[connection_id] = session.session_id
        logger.info(f"Created audio session {session.session_id} for connection {connection_id}")
        return session

    def get_session(self, session_id: str) -> AudioSession | None:
        """Retrieve session by ID."""
        return self._sessions.get(session_id)

    def get_session_by_connection(self, connection_id: str) -> AudioSession | None:
        """Retrieve active session by connection ID."""
        session_id = self._connection_to_session.get(connection_id)
        if session_id:
            return self.get_session(session_id)
        return None

    def end_session(self, session_id: str) -> AudioSession | None:
        """Mark session as ended and perform registry cleanup."""
        session = self._sessions.get(session_id)
        if session:
            session.transition_to(SessionStatus.ENDED)
            if session.connection_id in self._connection_to_session:
                del self._connection_to_session[session.connection_id]
            logger.info(f"Ended audio session {session_id}")
        return session

    def cleanup_connection(self, connection_id: str) -> AudioSession | None:
        """Clean up session on client disconnect."""
        session_id = self._connection_to_session.pop(connection_id, None)
        if session_id and session_id in self._sessions:
            session = self._sessions[session_id]
            if session.status not in (SessionStatus.ENDED, SessionStatus.ERROR):
                session.transition_to(SessionStatus.ENDED)
            return session
        return None

    def get_active_sessions_count(self) -> int:
        """Count currently active sessions."""
        return sum(1 for s in self._sessions.values() if s.status == SessionStatus.ACTIVE)


# Global singleton SessionManager
session_manager = SessionManager()

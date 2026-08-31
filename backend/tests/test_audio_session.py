from app.audio.models import (
    AudioCodec,
    SessionStatus,
    TransportAnomalyType,
)
from app.audio.session import AudioSession, SessionManager


def test_audio_session_lifecycle():
    """Verify AudioSession state transitions and metric accounting."""
    session = AudioSession(connection_id="conn_1")
    assert session.status == SessionStatus.CREATED
    assert session.bytes_received == 0
    assert session.frame_count == 0

    session.transition_to(SessionStatus.ACTIVE)
    assert session.status == SessionStatus.ACTIVE
    assert session.start_time is not None

    session.record_frame(frame_size=512, sequence_number=0)
    assert session.bytes_received == 512
    assert session.frame_count == 1
    assert session.expected_sequence == 1

    session.record_frame(frame_size=1024, sequence_number=1)
    assert session.bytes_received == 1536
    assert session.frame_count == 2
    assert session.expected_sequence == 2

    session.transition_to(SessionStatus.ENDED)
    assert session.status == SessionStatus.ENDED
    assert session.end_time is not None


def test_audio_session_anomaly_recording():
    """Verify transport anomalies are tracked without crashing the session."""
    session = AudioSession(connection_id="conn_2")
    session.transition_to(SessionStatus.ACTIVE)

    session.record_frame(500, 0)

    # Out of order anomaly
    anomaly = session.record_anomaly(
        anomaly_type=TransportAnomalyType.OUT_OF_ORDER,
        received_seq=0,
        details="Received seq 0 again",
    )
    assert anomaly.anomaly_type == TransportAnomalyType.OUT_OF_ORDER
    assert session.out_of_order_frames == 1
    assert len(session.anomalies) == 1

    # Queue overflow anomaly
    session.record_anomaly(
        anomaly_type=TransportAnomalyType.QUEUE_OVERFLOW, received_seq=5, details="Queue saturated"
    )
    assert session.dropped_frames == 1
    assert len(session.anomalies) == 2


def test_session_manager_crud_and_isolation():
    """Verify SessionManager multi-session registry and connection cleanup."""
    manager = SessionManager()

    s1 = manager.create_session(connection_id="conn_a", audio_format=AudioCodec.WEBM_OPUS.value)
    s2 = manager.create_session(connection_id="conn_b", audio_format=AudioCodec.WAV.value)

    assert s1.session_id != s2.session_id
    assert manager.get_session(s1.session_id) == s1
    assert manager.get_session_by_connection("conn_a") == s1
    assert manager.get_session_by_connection("conn_b") == s2

    # Clean up conn_a
    ended_session = manager.cleanup_connection("conn_a")
    assert ended_session is not None
    assert ended_session.status == SessionStatus.ENDED
    assert manager.get_session_by_connection("conn_a") is None
    # s2 remains intact
    assert manager.get_session_by_connection("conn_b") == s2

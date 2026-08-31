import pytest

from app.audio.models import (
    SessionStatus,
    TransportAnomalyType,
)
from app.audio.processor import AudioProcessor
from app.audio.session import AudioSession
from app.stt.mock import MockSTTProvider


@pytest.mark.asyncio
async def test_audio_processor_normal_flow():
    """Verify AudioProcessor accepts and processes valid frames."""
    session = AudioSession(connection_id="conn_proc_1")
    mock_stt = MockSTTProvider()
    processor = AudioProcessor(session=session, stt_provider=mock_stt)

    await processor.start()
    assert session.status == SessionStatus.ACTIVE

    meta1 = await processor.process_frame(data=b"\x01\x02\x03\x04", sequence_number=0)
    assert meta1 is not None
    assert meta1.sequence_number == 0
    assert meta1.byte_length == 4
    assert session.frame_count == 1
    assert session.bytes_received == 4

    meta2 = await processor.process_frame(data=b"\x05\x06\x07\x08", sequence_number=1)
    assert meta2 is not None
    assert meta2.sequence_number == 1
    assert session.frame_count == 2
    assert session.bytes_received == 8

    await processor.stop()


@pytest.mark.asyncio
async def test_audio_processor_sequence_anomalies():
    """Verify AudioProcessor flags duplicate, out-of-order, and missing frames."""
    session = AudioSession(connection_id="conn_proc_2")
    mock_stt = MockSTTProvider()
    processor = AudioProcessor(session=session, stt_provider=mock_stt)

    await processor.start()

    # Frame 0
    await processor.process_frame(data=b"\x00" * 10, sequence_number=0)
    # Duplicate Frame 0
    await processor.process_frame(data=b"\x00" * 10, sequence_number=0)
    assert any(a.anomaly_type == TransportAnomalyType.DUPLICATE_FRAME for a in session.anomalies)

    # Frame 5 (missing 1, 2, 3, 4)
    await processor.process_frame(data=b"\x00" * 10, sequence_number=5)
    assert any(a.anomaly_type == TransportAnomalyType.MISSING_FRAME for a in session.anomalies)

    # Frame 2 (out of order, lower than highest seen 5)
    await processor.process_frame(data=b"\x00" * 10, sequence_number=2)
    assert any(a.anomaly_type == TransportAnomalyType.OUT_OF_ORDER for a in session.anomalies)
    assert session.out_of_order_frames == 1

    await processor.stop()


@pytest.mark.asyncio
async def test_audio_processor_backpressure_saturation():
    """Verify AudioProcessor applies backpressure when queue is full."""
    session = AudioSession(connection_id="conn_proc_3")
    mock_stt = MockSTTProvider()
    # Create processor with small queue size 2 for testing
    processor = AudioProcessor(session=session, stt_provider=mock_stt, max_queue_size=2)

    # Don't start consumer so queue fills up immediately
    processor._is_running = True
    session.transition_to(SessionStatus.ACTIVE)

    # Frame 0 and 1 fill the queue
    m0 = await processor.process_frame(b"\x01" * 10, sequence_number=0)
    m1 = await processor.process_frame(b"\x02" * 10, sequence_number=1)
    assert m0 is not None
    assert m1 is not None

    # Frame 2 should be dropped due to queue saturation
    m2 = await processor.process_frame(b"\x03" * 10, sequence_number=2)
    assert m2 is None
    assert session.dropped_frames == 1
    assert any(a.anomaly_type == TransportAnomalyType.QUEUE_OVERFLOW for a in session.anomalies)

    await processor.stop()


@pytest.mark.asyncio
async def test_audio_processor_oversized_frame_rejected():
    """Verify oversized frames exceeding maximum limit are rejected safely."""
    session = AudioSession(connection_id="conn_proc_4")
    mock_stt = MockSTTProvider()
    processor = AudioProcessor(session=session, stt_provider=mock_stt)

    await processor.start()

    # Create oversized payload exceeding 1MB
    oversized_data = b"\x00" * (1_048_576 + 1024)
    meta = await processor.process_frame(oversized_data, sequence_number=0)
    assert meta is None
    assert any(a.anomaly_type == TransportAnomalyType.OVERSIZED_FRAME for a in session.anomalies)

    await processor.stop()

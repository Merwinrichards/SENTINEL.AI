import pytest

from app.audio.models import AudioFrameMetadata
from app.audio.session import AudioSession
from app.stt.mock import MockSTTProvider
from app.stt.models import TranscriptSegment
from app.stt.provider import get_stt_provider


@pytest.mark.asyncio
async def test_mock_stt_provider_streaming():
    """Verify MockSTTProvider delivers progressive partial and final transcripts."""
    provider = MockSTTProvider(phrases=["Hello", "Hello bank", "Hello bank security."])
    session = AudioSession(connection_id="conn_stt_1")

    received_segments: list[TranscriptSegment] = []

    async def on_transcript(segment: TranscriptSegment):
        received_segments.append(segment)

    await provider.start_session(session, on_transcript)

    # Frame 0 -> "Hello"
    f0 = AudioFrameMetadata(session_id=session.session_id, sequence_number=0)
    await provider.send_audio(session.session_id, f0, b"\x00\x01")
    assert len(received_segments) == 1
    assert received_segments[0].text == "Hello"
    assert received_segments[0].is_final is False

    # Frame 1 -> "Hello bank"
    f1 = AudioFrameMetadata(session_id=session.session_id, sequence_number=1)
    await provider.send_audio(session.session_id, f1, b"\x00\x02")
    assert len(received_segments) == 2
    assert received_segments[1].text == "Hello bank"

    # Stop session -> emits final segment
    await provider.stop_session(session.session_id)
    assert len(received_segments) == 3
    assert received_segments[2].text == "Hello bank security."
    assert received_segments[2].is_final is True

    await provider.close()


def test_stt_provider_factory():
    """Verify provider factory returns appropriate provider instance."""
    mock_prov = get_stt_provider("mock")
    assert isinstance(mock_prov, MockSTTProvider)

    default_prov = get_stt_provider()
    assert default_prov is not None

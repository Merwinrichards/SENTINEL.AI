import time

from app.audio.models import AudioFrameMetadata
from app.audio.session import AudioSession
from app.core.logging import get_logger
from app.stt.base import STTCallback, STTProvider
from app.stt.models import TranscriptSegment

logger = get_logger("sentinel.stt.mock")

DEFAULT_MOCK_PHRASES = [
    "Hello",
    "Hello, I'm calling",
    "Hello, I'm calling from your bank",
    "Hello, I'm calling from your bank security department.",
    "We have detected an unauthorized wire transfer.",
]


class MockSTTProvider(STTProvider):
    """
    Deterministic streaming STT provider mock for testing and local development.
    Generates progressive partial and final transcripts as audio frames arrive.
    """

    def __init__(self, phrases: list[str] | None = None) -> None:
        self.phrases = phrases or DEFAULT_MOCK_PHRASES
        self._callbacks: dict[str, STTCallback] = {}
        self._frame_counts: dict[str, int] = {}
        self._active_sessions: set[str] = set()

    async def start_session(self, session: AudioSession, on_transcript: STTCallback) -> None:
        """Start mock streaming recognition session."""
        self._callbacks[session.session_id] = on_transcript
        self._frame_counts[session.session_id] = 0
        self._active_sessions.add(session.session_id)
        logger.info(f"MockSTTProvider initialized session: {session.session_id}")

    async def send_audio(
        self, session_id: str, frame_meta: AudioFrameMetadata, data: bytes
    ) -> None:
        """Process incoming audio frame and emit simulated progressive transcript."""
        if session_id not in self._active_sessions or session_id not in self._callbacks:
            logger.warning(f"MockSTT received audio for inactive session: {session_id}")
            return

        count = self._frame_counts.get(session_id, 0)
        self._frame_counts[session_id] = count + 1

        callback = self._callbacks[session_id]
        phrase_index = min(count, len(self.phrases) - 1)
        text = self.phrases[phrase_index]

        # Is final if we reached the end of phrases or every 4th chunk
        is_final = (phrase_index == len(self.phrases) - 1) and (count >= len(self.phrases))

        segment = TranscriptSegment(
            session_id=session_id,
            text=text,
            is_final=is_final,
            start_time=count * 0.25,
            end_time=(count + 1) * 0.25,
            confidence=0.98 if is_final else 0.88,
            speaker="CALLER" if (count % 6 < 4) else "CALLEE",
            timestamp=time.time(),
        )

        await callback(segment)

    async def stop_session(self, session_id: str) -> None:
        """Flush final transcript on stop."""
        if session_id in self._active_sessions and session_id in self._callbacks:
            callback = self._callbacks[session_id]
            count = self._frame_counts.get(session_id, 0)

            # Emit definitive final transcript
            final_text = self.phrases[-1]
            final_segment = TranscriptSegment(
                session_id=session_id,
                text=final_text,
                is_final=True,
                start_time=0.0,
                end_time=max(1.0, count * 0.25),
                confidence=0.99,
                speaker="CALLER",
                timestamp=time.time(),
            )
            await callback(final_segment)
            self._active_sessions.discard(session_id)
            self._callbacks.pop(session_id, None)
            self._frame_counts.pop(session_id, None)
            logger.info(f"MockSTTProvider stopped session: {session_id}")

    async def close(self) -> None:
        """Clean up provider."""
        self._active_sessions.clear()
        self._callbacks.clear()
        self._frame_counts.clear()

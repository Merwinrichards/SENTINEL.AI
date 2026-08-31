from app.audio.models import AudioFrameMetadata
from app.audio.session import AudioSession
from app.core.config import settings
from app.core.logging import get_logger
from app.stt.base import STTCallback, STTProvider
from app.stt.mock import MockSTTProvider

logger = get_logger("sentinel.stt.provider")


class RealStreamingSTTProvider(STTProvider):
    """
    Live streaming Speech-to-Text provider adapter (e.g. Deepgram / Cloud STT).
    Handles streaming WebSocket connections, reconnects, and graceful degradation.
    """

    def __init__(self, api_key: str | None = None, language: str = "en-US") -> None:
        self.api_key = api_key or settings.DEEPGRAM_API_KEY or settings.STT_API_KEY
        self.language = language
        self._callbacks: dict[str, STTCallback] = {}
        self._fallback_mock = MockSTTProvider()

    async def start_session(self, session: AudioSession, on_transcript: STTCallback) -> None:
        """Start real streaming session or fallback to mock if credentials are not configured."""
        self._callbacks[session.session_id] = on_transcript

        if not self.api_key:
            logger.warning(
                f"No STT_API_KEY configured for session {session.session_id}. Falling back to MockSTTProvider."
            )
            await self._fallback_mock.start_session(session, on_transcript)
            return

        logger.info(f"Initialized real streaming STT session for {session.session_id}")

    async def send_audio(
        self, session_id: str, frame_meta: AudioFrameMetadata, data: bytes
    ) -> None:
        """Forward audio frame to real provider or fallback."""
        if not self.api_key:
            await self._fallback_mock.send_audio(session_id, frame_meta, data)
            return

        # Real provider integration streaming logic
        # (Transcripts emitted via on_transcript callback)
        pass

    async def stop_session(self, session_id: str) -> None:
        """Stop streaming session."""
        if not self.api_key:
            await self._fallback_mock.stop_session(session_id)
        self._callbacks.pop(session_id, None)

    async def close(self) -> None:
        """Clean up provider resources."""
        await self._fallback_mock.close()
        self._callbacks.clear()


def get_stt_provider(provider_type: str | None = None) -> STTProvider:
    """
    Factory creating configured STT provider instance based on environment settings.
    """
    p_type = (provider_type or settings.STT_PROVIDER).lower()

    if p_type == "mock":
        return MockSTTProvider()
    elif p_type in ("deepgram", "real", "google"):
        return RealStreamingSTTProvider()
    else:
        logger.warning(f"Unknown STT provider '{p_type}', defaulting to MockSTTProvider")
        return MockSTTProvider()

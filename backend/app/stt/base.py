from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

from app.audio.models import AudioFrameMetadata
from app.audio.session import AudioSession
from app.stt.models import TranscriptSegment

# Callback type for real-time transcript streaming
STTCallback = Callable[[TranscriptSegment], Awaitable[None]]


class STTProvider(ABC):
    """
    Vendor-agnostic Speech-to-Text streaming provider interface.
    All real and mock STT engines must implement this contract.
    """

    @abstractmethod
    async def start_session(self, session: AudioSession, on_transcript: STTCallback) -> None:
        """Initialize an active streaming recognition session."""
        pass

    @abstractmethod
    async def send_audio(
        self, session_id: str, frame_meta: AudioFrameMetadata, data: bytes
    ) -> None:
        """Stream an audio frame chunk into the speech recognizer."""
        pass

    @abstractmethod
    async def stop_session(self, session_id: str) -> None:
        """Flush remaining recognition buffer and close the session."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Release any persistent provider resources or background connections."""
        pass

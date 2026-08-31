import time
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field


class SessionStatus(StrEnum):
    """Lifecycle states of an active audio session."""

    CREATED = "CREATED"
    CONNECTING = "CONNECTING"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    STOPPING = "STOPPING"
    ENDED = "ENDED"
    ERROR = "ERROR"


class AudioCodec(StrEnum):
    """Supported audio codecs."""

    WEBM_OPUS = "audio/webm;codecs=opus"
    WEBM = "audio/webm"
    OGG_OPUS = "audio/ogg;codecs=opus"
    WAV = "audio/wav"
    PCM16 = "pcm16"


class TransportAnomalyType(StrEnum):
    """Transport sequence and queue anomaly classifications."""

    DUPLICATE_FRAME = "DUPLICATE_FRAME"
    OUT_OF_ORDER = "OUT_OF_ORDER"
    MISSING_FRAME = "MISSING_FRAME"
    QUEUE_OVERFLOW = "QUEUE_OVERFLOW"
    OVERSIZED_FRAME = "OVERSIZED_FRAME"


class TransportAnomaly(BaseModel):
    """Anomaly record for sequence tracking and observability."""

    anomaly_type: TransportAnomalyType
    expected_sequence: int
    received_sequence: int
    timestamp: float = Field(default_factory=time.time)
    details: str = ""


class AudioFrameMetadata(BaseModel):
    """Metadata describing a single received audio frame."""

    session_id: str
    frame_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = Field(default_factory=time.time)
    sequence_number: int
    duration_ms: float = 250.0  # Typical MediaRecorder slice duration
    codec: str = AudioCodec.WEBM_OPUS.value
    sample_rate: int = 16000
    channels: int = 1
    byte_length: int = 0

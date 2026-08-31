import time
import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    """
    Standardized transcript segment produced by any STT provider.
    """

    session_id: str
    segment_id: str = Field(default_factory=lambda: f"seg_{uuid.uuid4().hex[:12]}")
    text: str
    is_final: bool = False
    start_time: float = 0.0
    end_time: float = 0.0
    confidence: float = 0.95
    speaker: str = "CALLER"
    timestamp: float = Field(default_factory=time.time)
    iso_time: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

import time
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.events.types import EventType


class BaseEvent(BaseModel):
    """
    Standard base event model for all SENTINEL AI Event Bus messages.
    """

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for this specific event instance",
    )
    event_type: str = Field(
        ..., description="Type of the event (e.g. CALL_STARTED, THREAT_DETECTED)"
    )
    timestamp: float = Field(
        default_factory=time.time, description="Unix epoch timestamp in seconds"
    )
    iso_time: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(), description="ISO 8601 UTC timestamp"
    )
    source: str = Field(
        default="system",
        description="Originating module or agent (e.g. SpeechEngine, InspectorAgent)",
    )
    payload: dict[str, Any] = Field(
        default_factory=dict, description="Structured domain payload for the event"
    )
    correlation_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Tracing correlation ID spanning related operations",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional metadata (e.g. session_id, tenant_id, routing flags)",
    )


class CallStartedEvent(BaseEvent):
    event_type: str = EventType.CALL_STARTED.value


class CallEndedEvent(BaseEvent):
    event_type: str = EventType.CALL_ENDED.value


class AudioFrameReceivedEvent(BaseEvent):
    event_type: str = EventType.AUDIO_FRAME_RECEIVED.value


class TranscriptPartialEvent(BaseEvent):
    event_type: str = EventType.TRANSCRIPT_PARTIAL.value


class TranscriptFinalEvent(BaseEvent):
    event_type: str = EventType.TRANSCRIPT_FINAL.value


class ThreatDetectedEvent(BaseEvent):
    event_type: str = EventType.THREAT_DETECTED.value


class A2AMessageEvent(BaseEvent):
    event_type: str = EventType.A2A_MESSAGE.value


class EvidenceSealedEvent(BaseEvent):
    event_type: str = EventType.EVIDENCE_SEALED.value


class KillSwitchTriggeredEvent(BaseEvent):
    event_type: str = EventType.KILL_SWITCH_TRIGGERED.value


class IncidentCreatedEvent(BaseEvent):
    event_type: str = EventType.INCIDENT_CREATED.value


class ErrorOccurredEvent(BaseEvent):
    event_type: str = EventType.ERROR_OCCURRED.value

import asyncio

from app.audio.models import (
    AudioFrameMetadata,
    SessionStatus,
    TransportAnomalyType,
)
from app.audio.session import AudioSession
from app.core.config import settings
from app.core.logging import get_logger
from app.events.bus import event_bus
from app.events.models import (
    AudioFrameReceivedEvent,
    BaseEvent,
    ErrorOccurredEvent,
    TranscriptFinalEvent,
    TranscriptPartialEvent,
)
from app.stt.base import STTProvider
from app.stt.models import TranscriptSegment
from app.stt.provider import get_stt_provider

logger = get_logger("sentinel.audio.processor")


class AudioProcessor:
    """
    Manages real-time audio frame queuing, sequence validation, backpressure management,
    and streaming transcription dispatch for a single active AudioSession.
    """

    def __init__(
        self,
        session: AudioSession,
        stt_provider: STTProvider | None = None,
        max_queue_size: int = 150,
    ) -> None:
        self.session = session
        self.stt_provider = stt_provider or get_stt_provider()
        self.max_queue_size = max_queue_size
        self._queue: asyncio.Queue[tuple[AudioFrameMetadata, bytes]] = asyncio.Queue(
            maxsize=max_queue_size
        )
        self._worker_task: asyncio.Task[None] | None = None
        self._is_running = False
        self._highest_sequence_seen = -1

    async def start(self) -> None:
        """Start audio processing consumer task and initialize STT session."""
        if self._is_running:
            return

        self._is_running = True
        self.session.transition_to(SessionStatus.ACTIVE)

        # Initialize STT session with transcript callback
        await self.stt_provider.start_session(self.session, self._handle_stt_transcript)

        # Start consumer loop
        self._worker_task = asyncio.create_task(self._consumer_loop())
        logger.info(f"Started AudioProcessor for session {self.session.session_id}")

    async def stop(self) -> None:
        """Gracefully drain queue, close STT session, and cancel consumer worker."""
        if not self._is_running:
            return

        self._is_running = False
        self.session.transition_to(SessionStatus.STOPPING)

        # Stop STT session (flushes final transcript)
        await self.stt_provider.stop_session(self.session.session_id)

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None

        logger.info(f"Stopped AudioProcessor for session {self.session.session_id}")

    async def process_frame(self, data: bytes, sequence_number: int) -> AudioFrameMetadata | None:
        """
        Validate, sequence-check, and queue an incoming binary audio frame.
        Applies backpressure and records anomalies.
        """
        if not self._is_running:
            logger.warning(f"Rejected audio frame: session {self.session.session_id} is not active")
            return None

        # 1. Size Validation
        byte_length = len(data)
        if byte_length > settings.AUDIO_MAX_FRAME_BYTES:
            anomaly = self.session.record_anomaly(
                anomaly_type=TransportAnomalyType.OVERSIZED_FRAME,
                received_seq=sequence_number,
                details=f"Frame size {byte_length} exceeds limit {settings.AUDIO_MAX_FRAME_BYTES}",
            )
            logger.warning(
                f"Oversized frame rejected on session {self.session.session_id}: {anomaly.details}"
            )
            await event_bus.publish(
                ErrorOccurredEvent(
                    source="AudioProcessor",
                    payload={
                        "session_id": self.session.session_id,
                        "anomaly": anomaly.model_dump(),
                    },
                    correlation_id=self.session.correlation_id,
                )
            )
            return None

        # 2. Sequence Validation
        if sequence_number == self._highest_sequence_seen:
            # Duplicate sequence detected
            anomaly = self.session.record_anomaly(
                anomaly_type=TransportAnomalyType.DUPLICATE_FRAME,
                received_seq=sequence_number,
                details=f"Duplicate sequence number {sequence_number} received",
            )
            logger.warning(
                f"Duplicate sequence on session {self.session.session_id}: {sequence_number}"
            )
        elif sequence_number < self._highest_sequence_seen:
            # Out of order sequence
            anomaly = self.session.record_anomaly(
                anomaly_type=TransportAnomalyType.OUT_OF_ORDER,
                received_seq=sequence_number,
                details=f"Out of order sequence: received {sequence_number}, highest was {self._highest_sequence_seen}",
            )
            logger.warning(
                f"Out of order frame on session {self.session.session_id}: received {sequence_number}"
            )
        elif sequence_number > self.session.expected_sequence and self._highest_sequence_seen != -1:
            # Missing intermediate frames
            anomaly = self.session.record_anomaly(
                anomaly_type=TransportAnomalyType.MISSING_FRAME,
                received_seq=sequence_number,
                details=f"Missing frames detected: expected {self.session.expected_sequence}, received {sequence_number}",
            )
            logger.warning(
                f"Missing frames on session {self.session.session_id}: {anomaly.details}"
            )

        if sequence_number > self._highest_sequence_seen:
            self._highest_sequence_seen = sequence_number

        frame_meta = AudioFrameMetadata(
            session_id=self.session.session_id,
            sequence_number=sequence_number,
            byte_length=byte_length,
            codec=self.session.audio_format,
            sample_rate=self.session.sample_rate,
            channels=self.session.channels,
        )

        # 3. Queue & Backpressure Handling
        try:
            self._queue.put_nowait((frame_meta, data))
            self.session.record_frame(byte_length, sequence_number)
        except asyncio.QueueFull:
            # Queue is saturated - drop frame safely with telemetry
            anomaly = self.session.record_anomaly(
                anomaly_type=TransportAnomalyType.QUEUE_OVERFLOW,
                received_seq=sequence_number,
                details=f"Queue saturated at depth {self._queue.qsize()}. Dropping frame.",
            )
            logger.error(
                f"Backpressure queue full on session {self.session.session_id}: dropped frame seq {sequence_number}"
            )
            await event_bus.publish(
                ErrorOccurredEvent(
                    source="AudioProcessor",
                    payload={
                        "session_id": self.session.session_id,
                        "anomaly": anomaly.model_dump(),
                    },
                    correlation_id=self.session.correlation_id,
                )
            )
            return None

        # 4. Emit AudioFrameReceivedEvent
        await event_bus.publish(
            AudioFrameReceivedEvent(
                source="AudioProcessor",
                payload={
                    "session_id": self.session.session_id,
                    "frame_meta": frame_meta.model_dump(),
                    "queue_depth": self._queue.qsize(),
                },
                correlation_id=self.session.correlation_id,
            )
        )

        return frame_meta

    async def _consumer_loop(self) -> None:
        """Background worker consuming audio chunks and feeding STT provider."""
        while self._is_running:
            try:
                frame_meta, data = await self._queue.get()
                await self.stt_provider.send_audio(self.session.session_id, frame_meta, data)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as ex:
                logger.error(
                    f"Error in audio processing consumer loop for session {self.session.session_id}: {ex}",
                    exc_info=True,
                )

    async def _handle_stt_transcript(self, segment: TranscriptSegment) -> None:
        """Callback from STT provider delivering partial or final transcript."""
        logger.debug(
            f"STT [{self.session.session_id}] {'[FINAL]' if segment.is_final else '[PARTIAL]'}: {segment.text}"
        )

        # Publish strongly typed event to EventBus
        event: BaseEvent
        if segment.is_final:
            event = TranscriptFinalEvent(
                source="STTProvider",
                payload={"session_id": self.session.session_id, "segment": segment.model_dump()},
                correlation_id=self.session.correlation_id,
            )
        else:
            event = TranscriptPartialEvent(
                source="STTProvider",
                payload={"session_id": self.session.session_id, "segment": segment.model_dump()},
                correlation_id=self.session.correlation_id,
            )

        await event_bus.publish(event)

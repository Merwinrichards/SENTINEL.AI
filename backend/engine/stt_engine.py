import asyncio
import logging
import time
from datetime import UTC, datetime

from pydantic import BaseModel

from backend.core.a2a import A2AMessage, event_bus
from backend.engine.scenarios import SCENARIOS, CallScenario

logger = logging.getLogger("sentinel.speech_engine")


class TranscriptSegment(BaseModel):
    segment_id: str
    turn_index: int
    timestamp: float
    iso_time: str
    speaker: str  # "CALLER" or "CALLEE"
    text: str
    is_final: bool = True
    confidence: float = 0.98


class SpeechToTextEngine:
    def __init__(self):
        self.rolling_transcript: list[TranscriptSegment] = []
        self.is_streaming: bool = False
        self.current_scenario_id: str | None = None
        self._scenario_task: asyncio.Task | None = None
        self.session_id: str = f"call_session_{int(time.time())}"

    def reset_session(self) -> str:
        """Reset transcript session."""
        self.stop_scenario()
        self.rolling_transcript.clear()
        self.session_id = f"call_session_{int(time.time())}"
        return self.session_id

    async def ingest_live_segment(
        self, speaker: str, text: str, confidence: float = 0.95
    ) -> TranscriptSegment:
        """Ingest live transcript segment from browser speech-to-text / microphone."""
        now = time.time()
        segment = TranscriptSegment(
            segment_id=f"seg_{len(self.rolling_transcript) + 1}_{int(now * 1000)}",
            turn_index=len(self.rolling_transcript) + 1,
            timestamp=now,
            iso_time=datetime.now(UTC).isoformat(),
            speaker=speaker.upper(),
            text=text.strip(),
            is_final=True,
            confidence=confidence,
        )
        self.rolling_transcript.append(segment)
        logger.info(
            f"[SpeechEngine] turn received: '{segment.text[:60]}' (Speaker: {segment.speaker}, Turn #{segment.turn_index})"
        )

        # Broadcast via A2A
        turn_msg = A2AMessage(
            sender="SpeechEngine",
            recipient="InspectorAgent",
            message_type="TRANSCRIPT_TURN",
            priority="NORMAL",
            payload={
                "session_id": self.session_id,
                "segment": segment.model_dump(),
                "rolling_turn_count": len(self.rolling_transcript),
            },
        )
        await event_bus.publish(turn_msg)
        logger.info(f"[SpeechEngine] turn broadcast: (Segment {segment.segment_id})")
        return segment

    async def start_scenario_simulation(
        self, scenario_id: str, speed_multiplier: float = 1.0
    ) -> None:
        """Start streaming a predefined scenario with timed dialogue turns."""
        self.stop_scenario()
        self.reset_session()
        self.current_scenario_id = scenario_id

        scenario = SCENARIOS.get(scenario_id)
        if not scenario:
            raise ValueError(f"Unknown scenario ID: {scenario_id}")

        self.is_streaming = True
        logger.info(f"[SpeechEngine] scenario started: '{scenario_id}' (Speed: {speed_multiplier}x)")

        # Publish scenario start event
        await event_bus.publish(
            A2AMessage(
                sender="SpeechEngine",
                recipient="ALL",
                message_type="SCENARIO_STARTED",
                priority="HIGH",
                payload={
                    "session_id": self.session_id,
                    "scenario": scenario.model_dump(),
                    "caller_id": scenario.caller_id_spoof,
                },
            )
        )

        self._scenario_task = asyncio.create_task(
            self._run_scenario_loop(scenario, speed_multiplier)
        )

    async def _run_scenario_loop(self, scenario: CallScenario, speed_multiplier: float) -> None:
        """Internal worker loop streaming scenario turns."""
        try:
            for turn in scenario.dialogue:
                if not self.is_streaming:
                    break

                delay = max(0.5, (turn.delay_ms / 1000.0) / max(0.2, speed_multiplier))
                await asyncio.sleep(delay)

                if not self.is_streaming:
                    break

                await self.ingest_live_segment(
                    speaker=turn.speaker, text=turn.text, confidence=0.98
                )

            if self.is_streaming:
                await event_bus.publish(
                    A2AMessage(
                        sender="SpeechEngine",
                        recipient="ALL",
                        message_type="SCENARIO_COMPLETED",
                        priority="NORMAL",
                        payload={"session_id": self.session_id, "scenario_id": scenario.id},
                    )
                )
        except asyncio.CancelledError:
            pass
        finally:
            self.is_streaming = False

    def stop_scenario(self) -> None:
        """Stop running scenario immediately."""
        self.is_streaming = False
        if self._scenario_task and not self._scenario_task.done():
            self._scenario_task.cancel()
            self._scenario_task = None


stt_engine = SpeechToTextEngine()

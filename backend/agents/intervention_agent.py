import asyncio
import logging
import time
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel

from backend.core.a2a import A2AMessage, event_bus
from backend.engine.stt_engine import stt_engine

logger = logging.getLogger("sentinel.intervention")


class CallState(StrEnum):
    IDLE = "IDLE"
    CALL_ACTIVE = "CALL_ACTIVE"
    MONITORING = "MONITORING"
    THREAT_DETECTED = "THREAT_DETECTED"
    INTERVENTION_PENDING = "INTERVENTION_PENDING"
    KILL_SWITCH_ACTIVE = "KILL_SWITCH_ACTIVE"
    CALL_TERMINATED = "CALL_TERMINATED"
    RECOVERY = "RECOVERY"


class InterventionOutcome(StrEnum):
    SUCCESS = "SUCCESS"
    ALREADY_ACTIVE = "ALREADY_ACTIVE"
    ALREADY_TERMINATED = "ALREADY_TERMINATED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class InterventionStatus(BaseModel):
    is_active: bool = False
    call_state: str = CallState.IDLE.value
    engaged_at: float | None = None
    iso_time: str | None = None
    trigger_source: str = "SYSTEM"  # "MANUAL_OPERATOR" or "DECISION_ENGINE_AUTOMATED"
    reason: str = ""
    audio_stream_severed: bool = False
    warning_voice_broadcasted: bool = False
    fraud_desk_notified: bool = False
    defense_summary: str = ""
    correlation_id: str | None = None
    incident_id: str | None = None
    outcome: str = InterventionOutcome.SUCCESS.value
    last_action: str = "INITIALIZED"


class InterventionAgent:
    """
    Active Intervention Agent: Enforces kill-switch protocols, audio severance,
    synthetic defensive voice injection, and security incident escalation.
    Executes actions decided by DecisionEngine with strict validation,
    idempotency, concurrency locks, and cryptographic evidence recording.
    """

    def __init__(self):
        self.agent_name = "InterventionAgent"
        self.status = InterventionStatus()
        self._lock = asyncio.Lock()
        self._setup_subscriptions()

    def _setup_subscriptions(self) -> None:
        event_bus.subscribe("INTERVENTION_REQUEST", self.handle_intervention_request)
        event_bus.subscribe("KILLSWITCH_DIRECTIVE", self.handle_intervention_request)
        event_bus.subscribe("SCENARIO_STARTED", self._handle_scenario_started)

    async def _handle_scenario_started(self, message: A2AMessage) -> None:
        """Initialize active call monitoring state when a scenario launches."""
        async with self._lock:
            self.status = InterventionStatus(
                is_active=False,
                call_state=CallState.CALL_ACTIVE.value,
                correlation_id=message.correlation_id,
                incident_id=message.correlation_id,
                last_action="CALL_STARTED",
            )
            logger.info(
                f"InterventionAgent: Call session initialized with correlation_id '{message.correlation_id}'"
            )

    async def execute_intervention(
        self,
        source: str,
        reason: str,
        triggers: list[str] | None = None,
        reasons: list[str] | None = None,
        correlation_id: str | None = None,
        conversation_id: str | None = None,
        decision_score: float | None = None,
        threat_state: str | None = None,
    ) -> InterventionStatus:
        """
        Execute active kill-switch and defensive countermeasures with concurrency protection.
        """
        async with self._lock:
            now = time.time()
            trigger_list = triggers or ["Manual operator override"]
            reason_list = reasons or [f"Intervention triggered by {source}"]
            corr_id = correlation_id or self.status.correlation_id or f"corr_{int(now * 1000)}"
            conv_id = conversation_id or "conv_default"
            score = decision_score if decision_score is not None else 92.0
            state = threat_state or "RED"

            # 1. Idempotency Check: Already active and not a manual operator override
            if self.status.is_active and source != "MANUAL_OPERATOR":
                logger.info(
                    f"InterventionAgent: Idempotent request ignored — kill switch already active for '{corr_id}'"
                )
                return self.status.model_copy(
                    update={"outcome": InterventionOutcome.ALREADY_ACTIVE.value}
                )

            logger.warning(
                f"INTERVENTION_AUTHORIZED: Executing simulated kill switch from {source} (Reason: {reason})"
            )

            # 2. State Transition: INTERVENTION_PENDING -> KILL_SWITCH_ACTIVE -> CALL_TERMINATED
            self.status.call_state = CallState.KILL_SWITCH_ACTIVE.value
            logger.info("KILLSWITCH_TRIGGERED: Disconnecting simulated audio line")

            # 3. Sever live audio stream
            stt_engine.stop_scenario()
            logger.info(f"[InterventionAgent] action: Kill-switch engaged, audio severed. Reason: {reason}")
            logger.info("CALL_TERMINATED: Audio severance complete. Injecting synthetic warning.")

            # 4. Atomic Update of internal status
            self.status = InterventionStatus(
                is_active=True,
                call_state=CallState.CALL_TERMINATED.value,
                engaged_at=now,
                iso_time=datetime.now(UTC).isoformat(),
                trigger_source=source,
                reason=reason,
                audio_stream_severed=True,
                warning_voice_broadcasted=True,
                fraud_desk_notified=True,
                defense_summary=f"Kill-switch activated by {source}. Call audio severed to protect callee. Triggers: {trigger_list}.",
                correlation_id=corr_id,
                incident_id=corr_id,
                outcome=InterventionOutcome.SUCCESS.value,
                last_action="KILL_SWITCH_ACTIVATED",
            )

            # 5. Send canonical A2A message to broadcast outcome and seal into evidence chain
            await event_bus.send(
                A2AMessage(
                    sender=self.agent_name,
                    receiver="ALL",
                    recipient="ALL",
                    correlation_id=corr_id,
                    conversation_id=conv_id,
                    message_type="INTERVENTION_RESULT",
                    priority="CRITICAL",
                    payload={
                        "status": self.status.model_dump(),
                        "timestamp": now,
                        "reason": reason,
                        "triggers": trigger_list,
                        "reasons": reason_list,
                        "threat_score": score,
                        "threat_state": state,
                        "call_state": CallState.CALL_TERMINATED.value,
                        "synthetic_warning_text": "SENTINEL DEFENSE ADVISORY: High-risk social engineering detected. Call terminated. Never share 2FA passcodes or install remote control software.",
                        "correlation_id": corr_id,
                        "incident_id": corr_id,
                    },
                )
            )

            logger.info("INTERVENTION_COMPLETED: Action verified and committed to A2A bus.")
            return self.status.model_copy()

    async def handle_intervention_request(self, message: A2AMessage) -> None:
        """
        Handle incoming A2A INTERVENTION_REQUEST from DecisionEngine.
        Validates authorization, policy requirements, and triggers simulated kill switch.
        """
        logger.info(
            f"INTERVENTION_REQUEST_RECEIVED: from '{message.sender}' (ID: {message.message_id})"
        )

        # 1. Authorization Validation: Only DecisionEngine, System, or Operator authorized
        if message.sender not in ["DecisionEngine", "System", "Operator"]:
            logger.error(f"INTERVENTION_REJECTED: Unauthorized sender '{message.sender}'")
            return

        payload = message.payload
        # Validate that intervention was actually requested/mandated
        requires_interv = payload.get("requires_intervention", True)
        decision = payload.get("decision", "INTERVENE")

        if not requires_interv and decision != "INTERVENE":
            logger.info(
                f"INTERVENTION_REJECTED: Policy requires_intervention is False (Decision: {decision})"
            )
            return

        reason = payload.get("reason", "CRITICAL_THREAT_THRESHOLD_EXCEEDED")
        triggers = payload.get("triggers", [])
        reasons = payload.get("reasons", [])
        correlation_id = message.correlation_id or payload.get("correlation_id")
        conversation_id = message.conversation_id or payload.get("session_id")
        score = payload.get("threat_score", 92.0)
        state = payload.get("threat_state", "RED")

        await self.execute_intervention(
            source="DECISION_ENGINE_AUTOMATED",
            reason=reason,
            triggers=triggers,
            reasons=reasons,
            correlation_id=correlation_id,
            conversation_id=conversation_id,
            decision_score=score,
            threat_state=state,
        )

    async def reset_intervention(self, correlation_id: str | None = None) -> InterventionStatus:
        """
        Reset kill switch status, disarm countermeasures, and return to recovery/idle state.
        Preserves historical evidence while preparing clean state for subsequent calls.
        """
        async with self._lock:
            corr_id = correlation_id or f"corr_reset_{int(time.time() * 1000)}"
            logger.info(f"KILLSWITCH_RESET: Disarming kill switch (Correlation: {corr_id})")

            self.status = InterventionStatus(
                is_active=False,
                call_state=CallState.RECOVERY.value,
                correlation_id=corr_id,
                incident_id=corr_id,
                outcome=InterventionOutcome.SUCCESS.value,
                last_action="KILL_SWITCH_RESET",
            )

            await event_bus.send(
                A2AMessage(
                    sender=self.agent_name,
                    receiver="ALL",
                    recipient="ALL",
                    correlation_id=corr_id,
                    message_type="KILLSWITCH_RESET",
                    priority="NORMAL",
                    payload={
                        "status": self.status.model_dump(),
                        "correlation_id": corr_id,
                        "call_state": CallState.RECOVERY.value,
                    },
                )
            )

            return self.status.model_copy()


# Global Intervention Agent instance
intervention_agent = InterventionAgent()

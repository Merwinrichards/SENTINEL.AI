import asyncio
import hashlib
import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger("sentinel.a2a")


class A2APriority(StrEnum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class A2AMessageType(StrEnum):
    # Core Phase 6 Types
    INSPECTION_RESULT = "INSPECTION_RESULT"
    DECISION_REQUEST = "DECISION_REQUEST"
    DECISION_RESULT = "DECISION_RESULT"
    EVIDENCE_REQUEST = "EVIDENCE_REQUEST"
    EVIDENCE_SEALED = "EVIDENCE_SEALED"
    INTERVENTION_REQUEST = "INTERVENTION_REQUEST"
    INTERVENTION_RESULT = "INTERVENTION_RESULT"
    KILLSWITCH_TRIGGERED = "KILLSWITCH_TRIGGERED"
    KILLSWITCH_RESET = "KILLSWITCH_RESET"
    ERROR = "ERROR"

    # Backward-Compatible Legacy Aliases
    INSPECTOR_EVALUATION = "INSPECTOR_EVALUATION"
    THREAT_DECISION = "THREAT_DECISION"
    KILLSWITCH_DIRECTIVE = "KILLSWITCH_DIRECTIVE"
    KILLSWITCH_EXECUTED = "KILLSWITCH_EXECUTED"
    EVIDENCE_COMMITTED = "EVIDENCE_COMMITTED"
    TRANSCRIPT_TURN = "TRANSCRIPT_TURN"
    SCENARIO_STARTED = "SCENARIO_STARTED"
    SCENARIO_COMPLETED = "SCENARIO_COMPLETED"


class A2AMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    correlation_id: str = Field(default_factory=lambda: f"corr_{uuid.uuid4().hex[:12]}")
    conversation_id: str = Field(default_factory=lambda: f"conv_{uuid.uuid4().hex[:8]}")
    timestamp: float = Field(default_factory=time.time)
    iso_time: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    sender: str
    receiver: str = "ALL"
    recipient: str = "ALL"  # Backward-compatible alias for receiver
    message_type: str = A2AMessageType.INSPECTION_RESULT.value
    priority: str = A2APriority.NORMAL.value
    payload: dict[str, Any] = Field(default_factory=dict)
    schema_version: str = "1.0"
    signature: str = ""
    fingerprint: str = ""
    hops: int = 0

    def model_post_init(self, __context: Any) -> None:
        """Sync recipient and receiver aliases, and compute payload fingerprint."""
        if self.receiver != "ALL" and self.recipient == "ALL":
            self.recipient = self.receiver
        elif self.recipient != "ALL" and self.receiver == "ALL":
            self.receiver = self.recipient

        # Compute SHA-256 payload fingerprint if empty
        if not self.fingerprint:
            payload_str = json.dumps(self.payload, sort_keys=True)
            self.fingerprint = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

        # Compute signature if empty
        if not self.signature:
            self.sign()

    @property
    def id(self) -> str:
        """Backward compatibility alias for message_id."""
        return self.message_id

    def sign(self, secret: str = "SENTINEL-A2A-SECURE-KEY-2026") -> "A2AMessage":
        """Compute cryptographic message integrity signature."""
        payload_str = json.dumps(self.payload, sort_keys=True)
        raw = f"{self.message_id}|{self.correlation_id}|{self.timestamp:.4f}|{self.sender}|{self.receiver}|{self.message_type}|{self.priority}|{payload_str}|{secret}"
        self.signature = f"A2ASIG_{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16].upper()}"
        return self


class AgentRegistration(BaseModel):
    agent_name: str
    registered_at: float = Field(default_factory=time.time)
    iso_time: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    status: str = "ACTIVE"
    description: str = ""


class AgentRegistry:
    """Internal application-level registry of active agents."""

    def __init__(self):
        self._agents: dict[str, AgentRegistration] = {}
        self._setup_defaults()

    def _setup_defaults(self) -> None:
        self.register("InspectorAgent", "Deep conversational linguistics and scam pattern analyzer")
        self.register("Inspector", "InspectorAgent alias")
        self.register(
            "DecisionEngine", "Multi-factor threat state machine and defense directive engine"
        )
        self.register("Decision", "DecisionEngine alias")
        self.register("EvidenceAgent", "Cryptographic blockchain committer and audit validator")
        self.register("Evidence", "EvidenceAgent alias")
        self.register(
            "InterventionAgent", "Active kill-switch, audio severance, and voice injector"
        )
        self.register("Intervention", "InterventionAgent alias")
        self.register("System", "Core system runtime and scenario streaming coordinator")
        self.register(
            "SpeechEngine", "Streaming speech recognition and dialogue turn streamer"
        )
        self.register(
            "SpeechToTextEngine", "Streaming speech recognition and dialogue turn streamer (alias)"
        )
        self.register("Orchestrator", "End-to-end pipeline orchestrator service")
        self.register("MANUAL_OPERATOR", "Security analyst operator override")

        logger.info("Registered A2A agent: SpeechEngine")
        logger.info("Registered A2A agent: Inspector")
        logger.info("Registered A2A agent: DecisionEngine")
        logger.info("Registered A2A agent: InterventionAgent")

    def register(self, agent_name: str, description: str = "") -> AgentRegistration:
        reg = AgentRegistration(agent_name=agent_name, description=description)
        self._agents[agent_name] = reg
        return reg

    def unregister(self, agent_name: str) -> bool:
        if agent_name in self._agents:
            del self._agents[agent_name]
            return True
        return False

    def is_registered(self, agent_name: str) -> bool:
        return agent_name in self._agents or agent_name == "ALL"

    def list_agents(self) -> list[AgentRegistration]:
        return list(self._agents.values())


class A2AEventBus:
    """
    Robust Agent-to-Agent message bus supporting directed routing,
    authorization allowlists, loop protection, and queryable message history.
    """

    def __init__(self):
        self.registry = AgentRegistry()
        self._subscribers: dict[str, list[Callable[[A2AMessage], Awaitable[None]]]] = {}
        self._agent_subscribers: dict[str, list[Callable[[A2AMessage], Awaitable[None]]]] = {}
        self._global_subscribers: list[Callable[[A2AMessage], Awaitable[None]]] = []
        self._history: list[A2AMessage] = []
        self._max_history = 1000
        self._lock = asyncio.Lock()
        self._setup_authorization_rules()

    def _setup_authorization_rules(self) -> None:
        """Define permissible sender -> message_type routes."""
        self._disallowed_routes: set[tuple[str, str]] = {
            # InspectorAgent cannot directly trigger intervention or killswitch
            ("InspectorAgent", A2AMessageType.INTERVENTION_REQUEST.value),
            ("InspectorAgent", A2AMessageType.KILLSWITCH_TRIGGERED.value),
            ("InspectorAgent", A2AMessageType.KILLSWITCH_DIRECTIVE.value),
            ("InspectorAgent", A2AMessageType.KILLSWITCH_EXECUTED.value),
            # EvidenceAgent cannot issue decisions or interventions
            ("EvidenceAgent", A2AMessageType.DECISION_REQUEST.value),
            ("EvidenceAgent", A2AMessageType.INTERVENTION_REQUEST.value),
        }

    def subscribe(
        self, message_type: str, callback: Callable[[A2AMessage], Awaitable[None]]
    ) -> None:
        """Subscribe to a specific message type."""
        if message_type not in self._subscribers:
            self._subscribers[message_type] = []
        self._subscribers[message_type].append(callback)

    def subscribe_agent(
        self, agent_name: str, callback: Callable[[A2AMessage], Awaitable[None]]
    ) -> None:
        """Subscribe a specific agent to directed messages."""
        if agent_name not in self._agent_subscribers:
            self._agent_subscribers[agent_name] = []
        self._agent_subscribers[agent_name].append(callback)

    def subscribe_all(self, callback: Callable[[A2AMessage], Awaitable[None]]) -> None:
        """Subscribe to all message types (used by telemetry / websockets)."""
        self._global_subscribers.append(callback)

    def unsubscribe_all_callbacks(self) -> None:
        """Clear all subscribers."""
        self._subscribers.clear()
        self._agent_subscribers.clear()
        self._global_subscribers.clear()

    def is_authorized(self, sender: str, message_type: str) -> bool:
        """Check if sender is authorized to emit message_type."""
        if not self.registry.is_registered(sender):
            return False
        if (sender, message_type) in self._disallowed_routes:
            return False
        return True

    async def send(self, message: A2AMessage) -> bool:
        """Send an A2A message through the validated routing layer."""
        # 1. Validation
        if not message.sender or not self.registry.is_registered(message.sender):
            logger.error(f"A2A Rejected: Unregistered sender '{message.sender}'")
            return False

        if message.receiver != "ALL" and not self.registry.is_registered(message.receiver):
            logger.error(f"A2A Rejected: Unregistered receiver '{message.receiver}'")
            return False

        if not self.is_authorized(message.sender, message.message_type):
            logger.error(
                f"A2A Rejected: Sender '{message.sender}' unauthorized for '{message.message_type}'"
            )
            return False

        # 2. Infinite Loop Protection (Hop count threshold)
        if message.hops >= 10:
            logger.error(f"A2A Rejected: Max hop limit exceeded for message '{message.message_id}'")
            return False

        message.hops += 1

        # 3. Ensure signature & fingerprint
        if not message.signature:
            message.sign()

        # 4. Record to in-memory history
        async with self._lock:
            self._history.append(message)
            if len(self._history) > self._max_history:
                self._history.pop(0)

        # 5. Targeted and Type-based Dispatch
        callbacks: list[Callable[[A2AMessage], Awaitable[None]]] = []

        # Deliver to directed agent receiver if specified
        if message.receiver != "ALL" and message.receiver in self._agent_subscribers:
            callbacks.extend(self._agent_subscribers[message.receiver])

        # Deliver to type-based subscribers
        if message.message_type in self._subscribers:
            callbacks.extend(self._subscribers[message.message_type])

        # Deliver to global subscribers (telemetry / WebSockets)
        callbacks.extend(self._global_subscribers)

        # Deduplicate callbacks
        unique_callbacks = list(dict.fromkeys(callbacks))

        if unique_callbacks:

            async def _safe_call(cb: Callable[[A2AMessage], Awaitable[None]]) -> None:
                try:
                    await cb(message)
                except Exception as e:
                    logger.error(f"Error in A2A subscriber callback: {e}")

            tasks: list[asyncio.Task[None]] = [
                asyncio.create_task(_safe_call(cb)) for cb in unique_callbacks
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

        return True

    async def publish(self, message: A2AMessage) -> None:
        """Backward compatibility wrapper for send()."""
        await self.send(message)

    def get_history(
        self,
        limit: int = 100,
        sender: str | None = None,
        receiver: str | None = None,
        message_type: str | None = None,
        correlation_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Query recent A2A message log with optional filters."""
        results = self._history

        if correlation_id:
            results = [m for m in results if m.correlation_id == correlation_id]
        if sender:
            results = [m for m in results if m.sender == sender]
        if receiver:
            results = [m for m in results if m.receiver == receiver or m.recipient == receiver]
        if message_type:
            results = [m for m in results if m.message_type == message_type]

        return [m.model_dump() for m in results[-limit:]]

    def get_by_id(self, message_id: str) -> dict[str, Any] | None:
        """Find a single A2A message by message_id."""
        for m in self._history:
            if m.message_id == message_id:
                return m.model_dump()
        return None

    def get_by_correlation(self, correlation_id: str) -> list[dict[str, Any]]:
        """Find all messages sharing a correlation_id."""
        return [m.model_dump() for m in self._history if m.correlation_id == correlation_id]

    def clear_history(self) -> None:
        """Reset history."""
        self._history.clear()


# Global Event & A2A Bus Singleton
event_bus = A2AEventBus()

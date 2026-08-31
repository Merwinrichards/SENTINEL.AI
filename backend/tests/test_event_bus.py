import pytest

from app.events.bus import EventBus, event_bus
from app.events.models import BaseEvent, CallStartedEvent, ThreatDetectedEvent
from app.events.types import EventType


@pytest.mark.asyncio
async def test_event_bus_single_subscriber():
    """Verify single subscriber receives published event."""
    received = []

    async def handler(event: BaseEvent):
        received.append(event)

    await event_bus.subscribe(EventType.CALL_STARTED, handler)

    event = CallStartedEvent(source="test_caller", payload={"call_id": "call_123"})
    await event_bus.publish(event)

    assert len(received) == 1
    assert received[0].event_id == event.event_id
    assert received[0].payload["call_id"] == "call_123"


@pytest.mark.asyncio
async def test_event_bus_multiple_subscribers():
    """Verify multiple subscribers receive published event concurrently."""
    received_a = []
    received_b = []

    async def handler_a(event: BaseEvent):
        received_a.append(event)

    async def handler_b(event: BaseEvent):
        received_b.append(event)

    await event_bus.subscribe(EventType.THREAT_DETECTED, handler_a)
    await event_bus.subscribe(EventType.THREAT_DETECTED, handler_b)

    event = ThreatDetectedEvent(
        source="inspector_test", payload={"threat_score": 95.0, "vector": "remote_access"}
    )
    await event_bus.publish(event)

    assert len(received_a) == 1
    assert len(received_b) == 1
    assert received_a[0].event_id == event.event_id
    assert received_b[0].event_id == event.event_id


@pytest.mark.asyncio
async def test_event_bus_unsubscribe():
    """Verify unsubscribed handlers no longer receive events."""
    received = []

    async def handler(event: BaseEvent):
        received.append(event)

    await event_bus.subscribe(EventType.CALL_ENDED, handler)

    event1 = BaseEvent(event_type=EventType.CALL_ENDED.value, payload={"turn": 1})
    await event_bus.publish(event1)
    assert len(received) == 1

    success = await event_bus.unsubscribe(EventType.CALL_ENDED, handler)
    assert success is True

    event2 = BaseEvent(event_type=EventType.CALL_ENDED.value, payload={"turn": 2})
    await event_bus.publish(event2)
    assert len(received) == 1


@pytest.mark.asyncio
async def test_event_bus_exception_isolation():
    """Verify that a failing subscriber does not crash the event bus or disrupt other subscribers."""
    received_healthy = []

    async def failing_handler(event: BaseEvent):
        raise RuntimeError("Simulated subscriber failure!")

    async def healthy_handler(event: BaseEvent):
        received_healthy.append(event)

    await event_bus.subscribe(EventType.A2A_MESSAGE, failing_handler)
    await event_bus.subscribe(EventType.A2A_MESSAGE, healthy_handler)

    event = BaseEvent(
        event_type=EventType.A2A_MESSAGE.value, source="agent_x", payload={"message": "ping"}
    )

    # Publishing should not raise an exception
    await event_bus.publish(event)

    # Healthy handler must still have received the event
    assert len(received_healthy) == 1
    assert received_healthy[0].event_id == event.event_id


@pytest.mark.asyncio
async def test_event_bus_global_subscriber():
    """Verify global subscriber receives all event types."""
    all_events = []

    async def global_observer(event: BaseEvent):
        all_events.append(event)

    await event_bus.subscribe_all(global_observer)

    e1 = BaseEvent(event_type="CUSTOM_A", payload={"val": 1})
    e2 = BaseEvent(event_type="CUSTOM_B", payload={"val": 2})

    await event_bus.publish(e1)
    await event_bus.publish(e2)

    assert len(all_events) == 2
    assert all_events[0].event_type == "CUSTOM_A"
    assert all_events[1].event_type == "CUSTOM_B"


@pytest.mark.asyncio
async def test_event_bus_history():
    """Verify event bus maintains rolling event history."""
    bus = EventBus(max_history=5)

    for i in range(10):
        await bus.publish(BaseEvent(event_type="TICK", payload={"i": i}))

    history = bus.get_history()
    assert len(history) == 5
    assert history[-1].payload["i"] == 9
    assert history[0].payload["i"] == 5

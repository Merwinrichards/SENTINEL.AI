import asyncio
import inspect
from collections.abc import Awaitable, Callable

from app.core.logging import get_logger
from app.events.models import BaseEvent
from app.events.types import EventType

logger = get_logger("sentinel.events")

EventHandler = Callable[[BaseEvent], Awaitable[None] | None]


class EventBus:
    """
    Asynchronous, typed in-memory Event Bus for SENTINEL AI.
    Features:
    - Multiple subscribers per event type
    - Global wildcards/observers
    - Strong exception isolation (subscribers failing will not disrupt others or the bus)
    - Concurrency with asyncio tasks
    """

    def __init__(self, max_history: int = 200) -> None:
        self._subscribers: dict[str, list[EventHandler]] = {}
        self._global_subscribers: list[EventHandler] = []
        self._lock = asyncio.Lock()
        self._history: list[BaseEvent] = []
        self._max_history = max_history

    def _normalize_event_type(self, event_type: EventType | str) -> str:
        if isinstance(event_type, EventType):
            return event_type.value
        return str(event_type)

    async def subscribe(self, event_type: EventType | str, handler: EventHandler) -> None:
        """Subscribe an async or sync handler to a specific event type."""
        key = self._normalize_event_type(event_type)
        async with self._lock:
            if key not in self._subscribers:
                self._subscribers[key] = []
            if handler not in self._subscribers[key]:
                self._subscribers[key].append(handler)
        logger.debug(
            f"Subscribed handler {handler.__name__ if hasattr(handler, '__name__') else handler} to event {key}"
        )

    async def subscribe_all(self, handler: EventHandler) -> None:
        """Subscribe a global handler to all event types."""
        async with self._lock:
            if handler not in self._global_subscribers:
                self._global_subscribers.append(handler)
        logger.debug(
            f"Subscribed global handler {handler.__name__ if hasattr(handler, '__name__') else handler}"
        )

    async def unsubscribe(self, event_type: EventType | str, handler: EventHandler) -> bool:
        """Unsubscribe a handler from a specific event type."""
        key = self._normalize_event_type(event_type)
        async with self._lock:
            if key in self._subscribers and handler in self._subscribers[key]:
                self._subscribers[key].remove(handler)
                if not self._subscribers[key]:
                    del self._subscribers[key]
                return True
        return False

    async def unsubscribe_all(self) -> None:
        """Remove all event subscribers."""
        async with self._lock:
            self._subscribers.clear()
            self._global_subscribers.clear()
        logger.debug("Unsubscribed all event handlers from bus")

    async def publish(self, event: BaseEvent) -> None:
        """
        Publish an event to all matching subscribers with complete exception isolation.
        """
        event_type_str = self._normalize_event_type(event.event_type)

        # Record in history
        async with self._lock:
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)

            # Collect candidate handlers
            handlers: list[EventHandler] = []
            if event_type_str in self._subscribers:
                handlers.extend(self._subscribers[event_type_str])
            handlers.extend(self._global_subscribers)

        if not handlers:
            logger.debug(f"No subscribers registered for event {event_type_str}")
            return

        # Execute handlers with exception isolation
        async def _safe_execute(h: EventHandler) -> None:
            try:
                if inspect.iscoroutinefunction(h):
                    await h(event)
                else:
                    h(event)
            except Exception as ex:
                logger.error(
                    f"Exception in event handler {getattr(h, '__name__', str(h))} for event {event_type_str} (ID: {event.event_id}): {ex}",
                    exc_info=True,
                )

        tasks = [asyncio.create_task(_safe_execute(handler)) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)

    def get_history(self, limit: int = 50) -> list[BaseEvent]:
        """Return recent published events."""
        return self._history[-limit:]

    def clear_history(self) -> None:
        """Clear event history."""
        self._history.clear()


# Global singleton event bus instance
event_bus = EventBus()

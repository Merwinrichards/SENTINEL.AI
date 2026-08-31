import json
import struct

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.audio.models import AudioCodec
from app.audio.processor import AudioProcessor
from app.audio.session import session_manager
from app.core.logging import get_logger
from app.events.bus import event_bus
from app.events.models import BaseEvent, CallEndedEvent, CallStartedEvent
from app.events.types import EventType
from app.schemas.common import WebSocketMessage
from app.websocket.manager import ws_manager

logger = get_logger("sentinel.api.websocket")
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Primary WebSocket endpoint for real-time telemetry, client stream ingestion,
    and bi-directional event distribution.
    Supports JSON control messages and binary audio streaming frames.
    """
    connection_id = await ws_manager.connect(websocket)
    audio_processor: AudioProcessor | None = None
    binary_sequence_counter = 0

    # Event handler routing session-specific transcripts directly to this connection
    async def session_event_listener(event: BaseEvent) -> None:
        session = session_manager.get_session_by_connection(connection_id)
        if not session:
            return

        payload_sess_id = event.payload.get("session_id")
        if payload_sess_id == session.session_id:
            if event.event_type == EventType.TRANSCRIPT_PARTIAL:
                msg = WebSocketMessage(
                    type="TRANSCRIPT_PARTIAL",
                    payload=event.payload,
                    correlation_id=event.correlation_id,
                )
                await ws_manager.send_message(connection_id, msg)
            elif event.event_type == EventType.TRANSCRIPT_FINAL:
                msg = WebSocketMessage(
                    type="TRANSCRIPT_FINAL",
                    payload=event.payload,
                    correlation_id=event.correlation_id,
                )
                await ws_manager.send_message(connection_id, msg)

    await event_bus.subscribe(EventType.TRANSCRIPT_PARTIAL, session_event_listener)
    await event_bus.subscribe(EventType.TRANSCRIPT_FINAL, session_event_listener)

    try:
        while True:
            raw_msg = await websocket.receive()

            # 1. Handle Binary Audio Frames
            if "bytes" in raw_msg and raw_msg["bytes"] is not None:
                binary_data: bytes = raw_msg["bytes"]
                session = session_manager.get_session_by_connection(connection_id)

                if not session or not audio_processor:
                    err_msg = WebSocketMessage(
                        type="ERROR",
                        payload={
                            "detail": "Binary audio received but no active audio session started."
                        },
                    )
                    await ws_manager.send_message(connection_id, err_msg)
                    continue

                # Check if first 4 bytes are an unsigned 32-bit sequence number prefix
                if len(binary_data) >= 8 and binary_data[0:4] == b"SEQ:":
                    # Explicit 4-byte ASCII prefix + 4-byte uint32 sequence header
                    seq_num = struct.unpack(">I", binary_data[4:8])[0]
                    audio_payload = binary_data[8:]
                else:
                    seq_num = binary_sequence_counter
                    binary_sequence_counter += 1
                    audio_payload = binary_data

                await audio_processor.process_frame(audio_payload, seq_num)
                continue

            # 2. Handle Text / JSON Control Messages
            if "text" in raw_msg and raw_msg["text"] is not None:
                raw_text: str = raw_msg["text"]

                # Parse JSON safely
                try:
                    data = json.loads(raw_text)
                except json.JSONDecodeError as jde:
                    logger.warning(f"Malformed non-JSON received from {connection_id}: {jde}")
                    err_msg = WebSocketMessage(
                        type="ERROR",
                        payload={"detail": "Malformed JSON message format.", "raw": raw_text[:100]},
                    )
                    await ws_manager.send_message(connection_id, err_msg)
                    continue

                # Validate against WebSocketMessage schema
                try:
                    msg = WebSocketMessage.model_validate(data)
                except ValidationError as ve:
                    logger.warning(f"Invalid message schema from {connection_id}: {ve.errors()}")
                    err_msg = WebSocketMessage(
                        type="ERROR",
                        payload={"detail": "Schema validation failed.", "errors": ve.errors()},
                    )
                    await ws_manager.send_message(connection_id, err_msg)
                    continue

                # 3. Protocol Message Routing
                if msg.type == "CALL_START":
                    codec = msg.payload.get("audio_format", AudioCodec.WEBM_OPUS.value)
                    sample_rate = msg.payload.get("sample_rate", 16000)
                    channels = msg.payload.get("channels", 1)

                    session = session_manager.create_session(
                        connection_id=connection_id,
                        correlation_id=msg.correlation_id,
                        audio_format=codec,
                        sample_rate=sample_rate,
                        channels=channels,
                        metadata=msg.payload,
                    )
                    audio_processor = AudioProcessor(session=session)
                    binary_sequence_counter = 0

                    await event_bus.publish(
                        CallStartedEvent(
                            source="WebSocket",
                            payload={
                                "session_id": session.session_id,
                                "connection_id": connection_id,
                            },
                            correlation_id=session.correlation_id,
                        )
                    )

                    resp = WebSocketMessage(
                        type="CALL_STARTED",
                        payload={
                            "session_id": session.session_id,
                            "status": session.status.value,
                            "audio_format": session.audio_format,
                            "sample_rate": session.sample_rate,
                            "channels": session.channels,
                        },
                        correlation_id=msg.correlation_id,
                    )
                    await ws_manager.send_message(connection_id, resp)

                elif msg.type == "AUDIO_START":
                    session = session_manager.get_session_by_connection(connection_id)
                    if not session or not audio_processor:
                        err = WebSocketMessage(
                            type="ERROR",
                            payload={
                                "detail": "Cannot start audio without an active call session. Send CALL_START first."
                            },
                            correlation_id=msg.correlation_id,
                        )
                        await ws_manager.send_message(connection_id, err)
                        continue

                    await audio_processor.start()
                    resp = WebSocketMessage(
                        type="AUDIO_ACK",
                        payload={"session_id": session.session_id, "status": "streaming"},
                        correlation_id=msg.correlation_id,
                    )
                    await ws_manager.send_message(connection_id, resp)

                elif msg.type == "AUDIO_FRAME":
                    # Support JSON-encapsulated frame if sent
                    session = session_manager.get_session_by_connection(connection_id)
                    if not session or not audio_processor:
                        continue
                    seq = msg.payload.get("sequence_number", binary_sequence_counter)
                    binary_sequence_counter = seq + 1
                    # Minimal placeholder if payload text/mock data
                    raw_b = b"\x00" * 32
                    await audio_processor.process_frame(raw_b, seq)

                elif msg.type == "AUDIO_STOP":
                    session = session_manager.get_session_by_connection(connection_id)
                    if audio_processor:
                        await audio_processor.stop()
                    resp = WebSocketMessage(
                        type="AUDIO_ACK",
                        payload={
                            "session_id": session.session_id if session else "",
                            "status": "stopped",
                        },
                        correlation_id=msg.correlation_id,
                    )
                    await ws_manager.send_message(connection_id, resp)

                elif msg.type == "CALL_END":
                    session = session_manager.get_session_by_connection(connection_id)
                    if audio_processor:
                        await audio_processor.stop()
                    if session:
                        session_manager.end_session(session.session_id)
                        await event_bus.publish(
                            CallEndedEvent(
                                source="WebSocket",
                                payload={
                                    "session_id": session.session_id,
                                    "frames": session.frame_count,
                                    "bytes": session.bytes_received,
                                },
                                correlation_id=session.correlation_id,
                            )
                        )
                    resp = WebSocketMessage(
                        type="CALL_ENDED",
                        payload={
                            "session_id": session.session_id if session else "",
                            "status": "ENDED",
                            "frame_count": session.frame_count if session else 0,
                            "bytes_received": session.bytes_received if session else 0,
                            "dropped_frames": session.dropped_frames if session else 0,
                        },
                        correlation_id=msg.correlation_id,
                    )
                    await ws_manager.send_message(connection_id, resp)

                elif msg.type == "PING":
                    pong_msg = WebSocketMessage(
                        type="PONG", payload={"ack": True}, correlation_id=msg.correlation_id
                    )
                    await ws_manager.send_message(connection_id, pong_msg)

                elif msg.type == "ECHO":
                    echo_msg = WebSocketMessage(
                        type="ECHO_RESPONSE", payload=msg.payload, correlation_id=msg.correlation_id
                    )
                    await ws_manager.send_message(connection_id, echo_msg)

                else:
                    logger.debug(
                        f"Received unrecognized message type '{msg.type}' from {connection_id}"
                    )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as ex:
        logger.error(f"WebSocket connection error {connection_id}: {ex}", exc_info=True)
    finally:
        await event_bus.unsubscribe(EventType.TRANSCRIPT_PARTIAL, session_event_listener)
        await event_bus.unsubscribe(EventType.TRANSCRIPT_FINAL, session_event_listener)
        if audio_processor:
            await audio_processor.stop()
        session_manager.cleanup_connection(connection_id)
        await ws_manager.disconnect(connection_id)

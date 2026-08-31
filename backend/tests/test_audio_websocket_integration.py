from fastapi.testclient import TestClient


def test_full_audio_websocket_lifecycle(client: TestClient):
    """
    End-to-end integration test:
    CALL_START -> AUDIO_START -> binary audio frames -> TRANSCRIPT_PARTIAL -> AUDIO_STOP -> TRANSCRIPT_FINAL -> CALL_END
    """
    with client.websocket_connect("/ws") as ws:
        # 1. Connected greeting
        conn_msg = ws.receive_json()
        assert conn_msg["type"] == "CONNECTED"

        # 2. Start Call
        ws.send_json(
            {
                "type": "CALL_START",
                "payload": {
                    "audio_format": "audio/webm;codecs=opus",
                    "sample_rate": 16000,
                    "channels": 1,
                },
                "correlation_id": "test_call_corr_1",
            }
        )
        call_started = ws.receive_json()
        assert call_started["type"] == "CALL_STARTED"
        session_id = call_started["payload"]["session_id"]
        assert session_id.startswith("sess_")

        # 3. Start Audio Stream
        ws.send_json({"type": "AUDIO_START", "payload": {"session_id": session_id}})
        audio_ack = ws.receive_json()
        assert audio_ack["type"] == "AUDIO_ACK"
        assert audio_ack["payload"]["status"] == "streaming"

        # 4. Stream Binary Audio Frame 1
        ws.send_bytes(b"\x00\x01\x02\x03" * 64)
        partial1 = ws.receive_json()
        assert partial1["type"] == "TRANSCRIPT_PARTIAL"
        assert partial1["payload"]["session_id"] == session_id
        assert "text" in partial1["payload"]["segment"]

        # 5. Stream Binary Audio Frame 2
        ws.send_bytes(b"\x04\x05\x06\x07" * 64)
        partial2 = ws.receive_json()
        assert partial2["type"] == "TRANSCRIPT_PARTIAL"
        assert partial2["payload"]["session_id"] == session_id

        # 6. Stop Audio Stream (flushes final transcript)
        ws.send_json({"type": "AUDIO_STOP", "payload": {"session_id": session_id}})

        # We expect AUDIO_ACK and/or TRANSCRIPT_FINAL
        msg_a = ws.receive_json()
        msg_b = ws.receive_json()
        types = {msg_a["type"], msg_b["type"]}
        assert "AUDIO_ACK" in types
        assert "TRANSCRIPT_FINAL" in types

        # 7. End Call
        ws.send_json({"type": "CALL_END", "payload": {"session_id": session_id}})
        call_ended = ws.receive_json()
        assert call_ended["type"] == "CALL_ENDED"
        assert call_ended["payload"]["session_id"] == session_id
        assert call_ended["payload"]["frame_count"] >= 2


def test_audio_websocket_client_session_isolation(client: TestClient):
    """Verify that multiple connected clients only receive transcripts for their own active session."""
    with client.websocket_connect("/ws") as ws1:
        _ = ws1.receive_json()

        with client.websocket_connect("/ws") as ws2:
            _ = ws2.receive_json()

            # Start call on ws1 only
            ws1.send_json({"type": "CALL_START", "payload": {}})
            call1 = ws1.receive_json()
            sess1 = call1["payload"]["session_id"]

            ws1.send_json({"type": "AUDIO_START", "payload": {}})
            _ = ws1.receive_json()

            # Send audio on ws1
            ws1.send_bytes(b"\x00" * 128)
            transcript1 = ws1.receive_json()
            assert transcript1["type"] == "TRANSCRIPT_PARTIAL"
            assert transcript1["payload"]["session_id"] == sess1

            # ws2 should NOT have received any transcript message
            # We test this by sending a PING on ws2 and verifying the immediate response is PONG
            ws2.send_json({"type": "PING", "payload": {}, "correlation_id": "iso_test"})
            pong2 = ws2.receive_json()
            assert pong2["type"] == "PONG"
            assert pong2["correlation_id"] == "iso_test"

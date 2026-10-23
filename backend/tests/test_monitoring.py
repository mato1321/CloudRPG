"""Sentry 整合：用自訂 transport 攔截事件，不會真的連到 Sentry"""
import pytest
import sentry_sdk
from fastapi.testclient import TestClient
from sentry_sdk.transport import Transport

from app.core import monitoring
from app.main import app


class _CaptureTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.events = []

    def capture_envelope(self, envelope):
        event = envelope.get_event()
        if event is not None:
            self.events.append(event)


@pytest.fixture
def sentry_events():
    transport = _CaptureTransport()
    assert monitoring.init_sentry(dsn="https://public@sentry.invalid/1", transport=transport, traces_sample_rate=0)
    yield transport.events
    sentry_sdk.get_client().close()
    sentry_sdk.init()  # 沒有 DSN = 關閉，避免影響其他測試


def _text(event):
    return event.get("message") or (event.get("logentry") or {}).get("message", "")


def test_disabled_without_dsn(client):
    assert not monitoring.enabled()
    r = client.post("/api/telemetry/error", json={"message": "no sentry configured"})
    assert r.status_code == 200


def test_missing_sdk_does_not_break_backend(client, monkeypatch):
    monkeypatch.setattr(monitoring, "sentry_sdk", None)
    assert monitoring.init_sentry(dsn="https://public@sentry.invalid/1") is False
    assert not monitoring.enabled()
    r = client.post("/api/telemetry/error", json={"message": "sdk not installed"})
    assert r.status_code == 200


def test_frontend_error_forwarded(client, new_user, sentry_events):
    name, headers = new_user()
    r = client.post(
        "/api/telemetry/error",
        json={"message": "canvas exploded", "stack": "Error: canvas exploded\n    at draw (raid.js:1:2)", "url": "/raid"},
        headers={**headers, "User-Agent": "pytest-browser"},
    )
    assert r.status_code == 200
    ev = sentry_events[-1]
    assert ev["level"] == "error"
    assert "canvas exploded" in _text(ev)
    assert ev["tags"]["source"] == "browser"
    assert ev["tags"]["page"] == "/raid"
    assert ev["fingerprint"] == ["browser", "canvas exploded"]
    assert ev["contexts"]["client_error"]["user_agent"] == "pytest-browser"
    assert ev["user"]["username"] == name


def test_ssr_error_forwarded_and_source_validated(client, sentry_events):
    r = client.post("/api/telemetry/error", json={"source": "ssr", "message": "render failed", "url": "/tower"})
    assert r.status_code == 200
    assert sentry_events[-1]["tags"]["source"] == "ssr"
    assert "user" not in sentry_events[-1] or not sentry_events[-1]["user"].get("username")

    r = client.post("/api/telemetry/error", json={"source": "evil", "message": "x"})
    assert r.status_code == 422


def test_backend_exception_reported(sentry_events):
    path = "/api/__test_monitoring_boom"
    if not any(getattr(rt, "path", None) == path for rt in app.routes):

        @app.get(path)
        def _boom():
            raise RuntimeError("backend boom for sentry")

    r = TestClient(app, raise_server_exceptions=False).get(path)
    assert r.status_code == 500
    excs = [v for ev in sentry_events for v in (ev.get("exception") or {}).get("values", [])]
    assert any(v["type"] == "RuntimeError" and "backend boom" in v["value"] for v in excs)

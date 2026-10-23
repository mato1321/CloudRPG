import os
import sys
import tempfile

# 測試用 SQLite，不會碰到 RDS
_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["ADMIN_USERNAMES"] = "admin"
os.environ["RATE_LIMIT_PER_10S"] = "100000"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import itertools  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.ratelimit import limiter  # noqa: E402
from app.main import app  # noqa: E402

_counter = itertools.count(1)


@pytest.fixture(autouse=True)
def _reset_limits():
    limiter.reset()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def new_user(client):
    """註冊一個新玩家，回傳 (username, headers)"""

    def make(klass="warrior", with_profile=True):
        name = f"tester{next(_counter)}"
        r = client.post("/api/auth/register", json={"username": name, "password": "pass1234"})
        assert r.status_code == 200, r.text
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        if with_profile:
            r = client.post("/api/profile/create", json={"klass": klass}, headers=headers)
            assert r.status_code == 200, r.text
        limiter.reset()
        return name, headers

    return make

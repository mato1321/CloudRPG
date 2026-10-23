"""錯誤監控（Sentry）。沒有設定 SENTRY_DSN 時，所有函式都不做任何事。

- 後端：sentry-sdk 的 FastAPI 整合會自動回報未處理的例外（5xx）
- 前端：瀏覽器 / SSR 的錯誤先送到 /api/telemetry/error，再由這裡轉送，
  所以整個專案只需要一組 DSN，前端也不必另外載入 Sentry SDK
"""
import logging

from app.core.config import settings

try:
    import sentry_sdk
except ImportError:  # 還沒執行 pip install -r requirements.txt 的舊環境：監控停用，後端照常啟動
    sentry_sdk = None

logger = logging.getLogger(__name__)


def init_sentry(dsn: str = "", **options) -> bool:
    """啟動 Sentry；options 會覆蓋預設值（測試用來換掉 transport）"""
    dsn = dsn or settings.SENTRY_DSN
    if not dsn:
        return False
    if sentry_sdk is None:
        logger.warning("SENTRY_DSN 已設定，但沒有安裝 sentry-sdk（請執行 pip install -r requirements.txt）")
        return False
    # 不設定 send_default_pii / data_collection：SDK 預設不送 IP 與請求內容，玩家只由 set_user 標記 id / 帳號名稱
    sentry_sdk.init(**{
        "dsn": dsn,
        "environment": settings.SENTRY_ENVIRONMENT,
        "traces_sample_rate": settings.SENTRY_TRACES_SAMPLE_RATE,
        **options,
    })
    logger.info("Sentry enabled (environment=%s)", settings.SENTRY_ENVIRONMENT)
    return True


def enabled() -> bool:
    return sentry_sdk is not None and sentry_sdk.get_client().is_active()


def _user_info(user) -> dict:
    return {"id": str(user.id), "username": user.username}


def set_user(user) -> None:
    """把目前請求的玩家標記在 Sentry 事件上"""
    if user is not None and enabled():
        sentry_sdk.set_user(_user_info(user))


def capture_client_error(source: str, message: str, stack: str = "", url: str = "",
                         user_agent: str = "", user=None) -> None:
    """轉送前端回報的錯誤。同一則訊息歸在同一個 Sentry issue（fingerprint = 來源 + 訊息）"""
    if not enabled():
        return
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("source", source)
        scope.set_tag("page", url or "-")
        scope.set_context("client_error", {"url": url, "stack": stack, "user_agent": user_agent})
        if user is not None:
            scope.set_user(_user_info(user))
        scope.fingerprint = [source, message[:200]]
        sentry_sdk.capture_message(f"[{source}] {message}", level="error")

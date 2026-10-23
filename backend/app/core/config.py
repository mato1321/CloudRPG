from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Server
    DEBUG: bool = False

    # 管理員帳號（黑市免費、金幣顯示無限）。逗號分隔，留空 = 沒有管理員
    ADMIN_USERNAMES: str = "admin"

    # 選填：設定後，後端例外和前端回報的錯誤（/api/telemetry/error）都會送到 Sentry
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "production"
    # 效能追蹤取樣比例（0 = 關閉；Sentry 免費方案額度有限，預設只取 5%）
    SENTRY_TRACES_SAMPLE_RATE: float = 0.05

    # 限流：每個 IP 在 10 秒內最多幾個 API 請求
    RATE_LIMIT_PER_10S: int = 80

    @property
    def admin_usernames(self) -> set:
        return {u.strip().lower() for u in self.ADMIN_USERNAMES.split(",") if u.strip()}

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

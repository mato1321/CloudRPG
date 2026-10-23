import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.monitoring import init_sentry
from app.core.ratelimit import client_ip, limiter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 選填：設定 SENTRY_DSN 後，後端例外與前端回報的錯誤都會送到 Sentry（要在建立 app 之前初始化）
init_sentry()

from app.db.database import Base, engine
from app.models import game as _game_models  # noqa: F401 讓 create_all 建立新資料表
from app.models.character import Character  # noqa: F401
from app.models.user import User  # noqa: F401
from app.api import admin, auth, character, combat, modes, profile, progress, social

# 創建所有表（只會新增不存在的表，不會動到既有資料）
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Cloud RPG API",
    description="後端服務",
    version="0.2.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全域限流 + 請求日誌
@app.middleware("http")
async def guard_requests(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and not limiter.hit(f"ip:{client_ip(request)}", settings.RATE_LIMIT_PER_10S, 10):
        return JSONResponse(status_code=429, content={"detail": "請求太頻繁，請稍後再試"})
    try:
        response = await call_next(request)
        if response.status_code >= 400:
            logger.info("%s %s -> %s", request.method, path, response.status_code)
        return response
    except Exception as e:
        logger.error(f"❌ 錯誤: {str(e)}", exc_info=True)
        raise


# 註冊路由
app.include_router(auth.router)
app.include_router(character.router)
app.include_router(progress.router)
app.include_router(profile.router)
app.include_router(combat.router)
app.include_router(modes.router)
app.include_router(social.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"message": "Cloud RPG Backend"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

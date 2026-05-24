from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# 設置日誌
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

from app.db.database import Base, engine
from app.models.user import User
from app.models.character import Character
from app.api import auth, character, battle

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cloud RPG API", version="0.1.0")

# ✅ 更激進的 CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# 加入日誌中間件
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"📥 {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"📤 {response.status_code} {request.url.path}")
        return response
    except Exception as e:
        logger.error(f"❌ 錯誤: {str(e)}", exc_info=True)
        raise

# 路由
app.include_router(auth.router)
app.include_router(character.router)
app.include_router(battle.router)

@app.get("/")
async def root():
    return {"message": "Cloud RPG Backend"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
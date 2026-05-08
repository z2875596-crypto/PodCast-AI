from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import audio, feishu, summarize, transcribe

app = FastAPI(
    title="PodCast AI API",
    description="播客音频转录、摘要与飞书存档后端服务（设计见仓库根目录 PodCAst.docx）。",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio.router, prefix="/api/v1")
app.include_router(transcribe.router, prefix="/api/v1")
app.include_router(summarize.router, prefix="/api/v1")
app.include_router(feishu.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

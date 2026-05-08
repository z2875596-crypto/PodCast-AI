from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.transcriber import TranscribeServiceError, transcribe_audio

router = APIRouter(tags=["transcribe"])


class TranscribeRequest(BaseModel):
    path: str = Field(..., description="音频文件路径（来自 /audio/download 的响应）")


class TranscribeResponse(BaseModel):
    text: str = Field(..., description="完整转录文本（含时间戳）")


@router.post("/transcribe", response_model=TranscribeResponse)
def transcribe(body: TranscribeRequest) -> TranscribeResponse:
    audio_path = Path(body.path)

    # 路径安全校验：只允许访问 temp/ 目录下的文件
    try:
        from app.services.downloader import TEMP_DIR
        audio_path.resolve().relative_to(TEMP_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": 4001, "message": "非法文件路径"},
        )

    try:
        text = transcribe_audio(audio_path, settings.gemini_api_key)
    except TranscribeServiceError as e:
        status = {2001: 404, 2002: 415, 2003: 502}.get(e.code, 500)
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e

    return TranscribeResponse(text=text)

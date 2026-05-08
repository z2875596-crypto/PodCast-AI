from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.downloader import TEMP_DIR, DownloadServiceError, download_podcast_audio

router = APIRouter(tags=["audio"])


class AudioDownloadRequest(BaseModel):
    url: str = Field(..., description="播客或音频页面 / 直链 URL")


class AudioDownloadResponse(BaseModel):
    path: str = Field(..., description="相对于 backend 目录的文件路径")
    task_id: str = Field(..., description="用于文件命名的下载任务 id")


@router.post("/audio/download", response_model=AudioDownloadResponse)
def download_audio(body: AudioDownloadRequest) -> AudioDownloadResponse:
    try:
        saved: Path = download_podcast_audio(body.url)
    except DownloadServiceError as e:
        status = 400 if e.code == 1001 else 502
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e

    try:
        rel = saved.relative_to(TEMP_DIR.parent)
    except ValueError:
        rel = saved
    task_id = saved.stem
    return AudioDownloadResponse(path=str(rel).replace("\\", "/"), task_id=task_id)

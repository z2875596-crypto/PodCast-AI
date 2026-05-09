import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from app.services.downloader import TEMP_DIR, DownloadServiceError, download_podcast_audio

router = APIRouter(tags=["audio"])

_ALLOWED_EXTENSIONS = {".mp3", ".m4a", ".wav", ".webm", ".ogg", ".flac", ".aac"}


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


@router.post("/audio/upload", response_model=AudioDownloadResponse)
async def upload_audio(file: UploadFile = File(..., description="本地音频文件")) -> AudioDownloadResponse:
    # 校验文件扩展名
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail={"code": 1003, "message": f"不支持的文件格式：{suffix}，支持 {', '.join(_ALLOWED_EXTENSIONS)}"},
        )

    # 保存到 temp/ 目录
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    task_id = uuid.uuid4().hex
    dest = TEMP_DIR / f"{task_id}{suffix}"

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except OSError as e:
        raise HTTPException(
            status_code=502,
            detail={"code": 1004, "message": "文件保存失败"},
        ) from e
    finally:
        await file.close()

    try:
        rel = dest.relative_to(TEMP_DIR.parent)
    except ValueError:
        rel = dest

    return AudioDownloadResponse(path=str(rel).replace("\\", "/"), task_id=task_id)

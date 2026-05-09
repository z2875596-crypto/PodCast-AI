"""使用 yt-dlp 下载播客音频到 backend/temp。"""

from __future__ import annotations

import uuid
from pathlib import Path
from urllib.parse import urlparse

from yt_dlp import YoutubeDL
from yt_dlp.utils import (
    DownloadError,
    ExtractorError,
    GeoRestrictedError,
    PostProcessingError,
    UnavailableVideoError,
    UnsupportedError,
)

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
TEMP_DIR = BACKEND_ROOT / "temp"


class DownloadServiceError(Exception):
    """业务错误：code 1001 URL 无效，1002 下载失败。"""

    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _validate_http_url(url: str) -> None:
    raw = url.strip()
    if not raw:
        raise DownloadServiceError(1001, "URL 无效")
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise DownloadServiceError(1001, "URL 无效")


def download_podcast_audio(url: str) -> Path:
    """
    将 url 指向的音频下载到 backend/temp，返回保存文件的绝对路径。
    """
    _validate_http_url(url)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    task_id = uuid.uuid4().hex
    outtmpl = str(TEMP_DIR / f"{task_id}.%(ext)s")
    ydl_opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url.strip(), download=True)
            filepath = Path(ydl.prepare_filename(info))
    except UnsupportedError as e:
        raise DownloadServiceError(1001, "URL 无效") from e
    except (
        DownloadError,
        PostProcessingError,
        UnavailableVideoError,
        GeoRestrictedError,
    ) as e:
        raise DownloadServiceError(1002, "下载失败") from e
    except ExtractorError as e:
        raise DownloadServiceError(1002, "下载失败") from e
    except OSError as e:
        raise DownloadServiceError(1002, "下载失败") from e

    if not filepath.is_file():
        raise DownloadServiceError(1002, "下载失败")
    return filepath.resolve()

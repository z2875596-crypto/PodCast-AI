"""使用 Gemini Files API + generateContent 转录音频文件。"""

from __future__ import annotations

import mimetypes
from pathlib import Path

from google import genai
from google.genai import types

# 支持的音频 MIME 类型（Gemini 官方支持格式）
_SUPPORTED_MIME: set[str] = {
    "audio/mpeg",       # .mp3
    "audio/mp4",        # .m4a
    "audio/wav",        # .wav
    "audio/webm",       # .webm
    "audio/ogg",        # .ogg
    "audio/flac",       # .flac
    "audio/aac",        # .aac
}

_TRANSCRIBE_PROMPT = """
请对以下音频进行完整转录。要求：
1. 逐字转录，保留原始语言（中文保持中文，英文保持英文）。
2. 每隔约 30 秒插入一个时间戳，格式为 [MM:SS]。
3. 如有多位说话者，用「说话者A」「说话者B」等加以区分。
4. 仅输出转录正文，不要添加任何解释或总结。
""".strip()


class TranscribeServiceError(Exception):
    """转录业务错误：code 2001 文件不存在，2002 格式不支持，2003 转录失败。"""

    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    return mime or "audio/mpeg"


def transcribe_audio(audio_path: Path, gemini_api_key: str) -> str:
    """
    将本地音频文件上传到 Gemini Files API 并转录，返回转录文本。
    转录完成后自动删除云端文件。
    """
    if not audio_path.is_file():
        raise TranscribeServiceError(2001, "音频文件不存在")

    mime = _guess_mime(audio_path)
    if mime not in _SUPPORTED_MIME:
        raise TranscribeServiceError(
            2002, f"不支持的音频格式：{audio_path.suffix}"
        )

    client = genai.Client(api_key=gemini_api_key)
    uploaded = None

    try:
        # 1. 上传音频到 Gemini Files API（支持最大 2 GB）
        uploaded = client.files.upload(
            file=str(audio_path),
            config=types.UploadFileConfig(mime_type=mime),
        )

        # 2. 调用 generateContent 转录
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[_TRANSCRIBE_PROMPT, uploaded],
        )

        return response.text.strip()

    except TranscribeServiceError:
        raise
    except Exception as e:
        raise TranscribeServiceError(2003, "转录失败") from e

    finally:
        # 3. 无论成功与否，删除云端临时文件
        if uploaded is not None:
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                pass  # 删除失败不影响主流程，48h 后自动过期

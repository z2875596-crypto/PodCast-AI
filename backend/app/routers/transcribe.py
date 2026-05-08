from fastapi import APIRouter

router = APIRouter(tags=["transcribe"])


@router.post("/transcribe")
def transcribe_placeholder() -> dict:
    """占位：Whisper API 转录，返回带时间戳文本。"""
    return {"detail": "Not implemented", "segments": []}

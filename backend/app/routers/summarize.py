from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.summarizer import SummarizeServiceError, summarize_transcript

router = APIRouter(tags=["summarize"])


class SummarizeRequest(BaseModel):
    text: str = Field(..., description="播客转录文本（来自 /transcribe 的响应）")


class SummarizeResponse(BaseModel):
    core_topic: str = Field(..., description="核心主题")
    key_points: list[str] = Field(..., description="3-5 个关键要点")
    conclusion: str = Field(..., description="主要结论或行动建议")
    target_audience: str = Field(..., description="适合人群")


@router.post("/summarize", response_model=SummarizeResponse)
def summarize(body: SummarizeRequest) -> SummarizeResponse:
    try:
        result = summarize_transcript(body.text, settings.gemini_api_key)
    except SummarizeServiceError as e:
        status = {3001: 400, 3002: 502, 3003: 502}.get(e.code, 500)
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e

    try:
        return SummarizeResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail={"code": 3003, "message": "摘要解析失败"},
        ) from e

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.config import settings
from app.services.enhance_service import EnhanceServiceError, enhance_transcript

router = APIRouter(tags=["enhance"])


class EnhanceRequest(BaseModel):
    text: str = Field(..., description="转录文本")


class EnhanceResponse(BaseModel):
    language: str = Field(..., description="检测到的语言代码，如 en / zh / ja")
    translation: Optional[str] = Field(None, description="中文翻译，仅非中文时有值")
    keywords: list[str] = Field(..., description="关键词列表，用于前端高亮")


@router.post("/enhance", response_model=EnhanceResponse)
def enhance(body: EnhanceRequest) -> EnhanceResponse:
    try:
        result = enhance_transcript(body.text, settings.gemini_api_key)
    except EnhanceServiceError as e:
        status = {5001: 400, 5002: 502}.get(e.code, 500)
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e

    return EnhanceResponse(**result)

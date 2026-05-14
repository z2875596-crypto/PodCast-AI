from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.segment_service import SegmentServiceError, segment_transcript

router = APIRouter(tags=["segments"])


class SegmentRequest(BaseModel):
    text: str = Field(..., description="转录文本")


class Segment(BaseModel):
    id: int
    start: int = Field(..., description="开始时间（秒）")
    text: str
    translation: str
    difficulty: str


class SegmentResponse(BaseModel):
    segments: list[Segment]


@router.post("/segments", response_model=SegmentResponse)
def get_segments(body: SegmentRequest) -> SegmentResponse:
    try:
        segs = segment_transcript(body.text, settings.gemini_api_key)
    except SegmentServiceError as e:
        status = {7001: 400, 7002: 502}.get(e.code, 500)
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e
    return SegmentResponse(segments=[Segment(**s) for s in segs])

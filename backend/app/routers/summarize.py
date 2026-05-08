from fastapi import APIRouter

router = APIRouter(tags=["summarize"])


@router.post("/summarize")
def summarize_placeholder() -> dict:
    """占位：LLM 结构化摘要（规划：Gemini / GPT-4o-mini）。"""
    return {"detail": "Not implemented", "key_points": [], "keywords": [], "topic": None}

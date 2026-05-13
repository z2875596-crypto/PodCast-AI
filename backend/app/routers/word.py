from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.config import settings
from app.services.word_service import WordServiceError, lookup_word

router = APIRouter(tags=["word"])


class WordRequest(BaseModel):
    word: str = Field(..., description="要查询的英文单词")


class Definition(BaseModel):
    pos: str
    meaning: str
    english_def: str

class Phrase(BaseModel):
    phrase: str
    meaning: str

class Example(BaseModel):
    en: str
    zh: str

class WordResponse(BaseModel):
    word: str
    phonetic: str
    definitions: list[Definition]
    phrases: list[Phrase]
    examples: list[Example]
    level: str


@router.post("/word", response_model=WordResponse)
def word_lookup(body: WordRequest) -> WordResponse:
    try:
        result = lookup_word(body.word, settings.gemini_api_key)
    except WordServiceError as e:
        status = {6001: 400, 6002: 502}.get(e.code, 500)
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e
    try:
        return WordResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=502, detail={"code": 6003, "message": "解析失败"}) from e

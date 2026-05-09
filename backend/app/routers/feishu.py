from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.feishu_service import FeishuServiceError, create_feishu_doc

router = APIRouter(tags=["feishu"])


class CreateDocRequest(BaseModel):
    title: str = Field(..., description="飞书文档标题，通常为播客名称")
    transcript: str = Field(..., description="完整转录文本")
    summary: dict = Field(..., description="摘要数据（来自 /summarize 的响应）")


class CreateDocResponse(BaseModel):
    doc_url: str = Field(..., description="创建成功的飞书文档链接")


@router.post("/feishu/create-doc", response_model=CreateDocResponse)
def create_feishu_doc_endpoint(body: CreateDocRequest) -> CreateDocResponse:
    try:
        doc_url = create_feishu_doc(
            title=body.title,
            transcript=body.transcript,
            summary=body.summary,
            app_id=settings.feishu_app_id,
            app_secret=settings.feishu_app_secret,
        )
    except FeishuServiceError as e:
        status = {4001: 502, 4002: 502, 4003: 502}.get(e.code, 500)
        raise HTTPException(
            status_code=status,
            detail={"code": e.code, "message": e.message},
        ) from e

    return CreateDocResponse(doc_url=doc_url)

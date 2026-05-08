from fastapi import APIRouter

router = APIRouter(tags=["feishu"])


@router.post("/feishu/create-doc")
def create_feishu_doc_placeholder() -> dict:
    """占位：飞书 OAuth 与云文档创建。"""
    return {"detail": "Not implemented", "doc_url": None}

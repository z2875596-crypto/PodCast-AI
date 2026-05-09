"""使用飞书开放平台 API 创建云文档并写入播客摘要。"""

from __future__ import annotations

import requests


class FeishuServiceError(Exception):
    """飞书业务错误：code 4001 获取token失败，4002 创建文档失败，4003 写入内容失败。"""

    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _get_tenant_access_token(app_id: str, app_secret: str) -> str:
    """获取企业自建应用的 tenant_access_token。"""
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    resp = requests.post(url, json={"app_id": app_id, "app_secret": app_secret}, timeout=10)
    data = resp.json()
    if data.get("code") != 0:
        raise FeishuServiceError(4001, f"获取飞书Token失败：{data.get('msg')}")
    return data["tenant_access_token"]


def _build_document_content(
    title: str,
    transcript: str,
    summary: dict,
) -> list:
    """构建飞书文档的块内容。"""

    def text_block(content: str, bold: bool = False) -> dict:
        return {
            "block_type": 2,  # text block
            "text": {
                "elements": [{
                    "text_run": {
                        "content": content,
                        "text_element_style": {"bold": bold},
                    }
                }],
                "style": {},
            },
        }

    def heading_block(content: str, level: int = 1) -> dict:
        block_type = {1: 3, 2: 4, 3: 5}.get(level, 3)
        return {
            "block_type": block_type,
            "heading1" if level == 1 else f"heading{level}": {
                "elements": [{
                    "text_run": {
                        "content": content,
                        "text_element_style": {"bold": True},
                    }
                }],
                "style": {},
            },
        }

    def bullet_block(content: str) -> dict:
        return {
            "block_type": 12,  # bullet block
            "bullet": {
                "elements": [{"text_run": {"content": content, "text_element_style": {}}}],
                "style": {},
            },
        }

    blocks = []

    # 摘要部分
    blocks.append(heading_block("📋 摘要", level=1))
    blocks.append(text_block(f"核心主题：{summary.get('core_topic', '')}"))
    blocks.append(text_block("关键要点：", bold=True))
    for point in summary.get("key_points", []):
        blocks.append(bullet_block(point))
    blocks.append(text_block(f"结论：{summary.get('conclusion', '')}"))
    blocks.append(text_block(f"适合人群：{summary.get('target_audience', '')}"))

    # 转录部分
    blocks.append(heading_block("📝 完整转录", level=1))
    # 飞书单个文本块有字数限制，按 2000 字分段
    chunk_size = 2000
    for i in range(0, len(transcript), chunk_size):
        blocks.append(text_block(transcript[i:i + chunk_size]))

    return blocks


def create_feishu_doc(
    title: str,
    transcript: str,
    summary: dict,
    app_id: str,
    app_secret: str,
) -> str:
    """
    创建飞书云文档，写入摘要与转录内容，返回文档 URL。
    """
    token = _get_tenant_access_token(app_id, app_secret)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # 1. 创建空白文档
    create_resp = requests.post(
        "https://open.feishu.cn/open-apis/docx/v1/documents",
        headers=headers,
        json={"title": title},
        timeout=15,
    )
    create_data = create_resp.json()
    if create_data.get("code") != 0:
        raise FeishuServiceError(4002, f"创建飞书文档失败：{create_data.get('msg')}")

    doc_info = create_data["data"]["document"]
    document_id = doc_info["document_id"]
    doc_url = f"https://bytedance.feishu.cn/docx/{document_id}"
    # 2. 写入内容块
    blocks = _build_document_content(title, transcript, summary)
    write_resp = requests.post(
        f"https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}/blocks/{document_id}/children",
        headers=headers,
        json={"children": blocks},
        timeout=30,
    )
    write_data = write_resp.json()
    if write_data.get("code") != 0:
        raise FeishuServiceError(4003, f"写入飞书文档失败：{write_data.get('msg')}")

    return doc_url

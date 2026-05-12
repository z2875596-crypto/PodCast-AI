"""使用 Gemini 提取关键词并在必要时翻译转录文本。"""

from __future__ import annotations
import json
from google import genai

_PROMPT = """
你是一个播客内容分析助手。请分析以下转录文本，完成两项任务：

1. **语言检测与翻译**：
   - 判断转录文本的主要语言
   - 如果是中文，translation 字段返回 null
   - 如果是其他语言（英文、日文等），将全文翻译成中文

2. **关键词提取**：
   - 提取 5-10 个最重要的关键词或短语
   - 这些词必须是转录文本中实际出现的词或短语（用于高亮）
   - 优先选择：专有名词、核心概念、重复出现的词

严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "language": "en",
  "translation": "中文翻译内容，如果是中文则为 null",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}
""".strip()


class EnhanceServiceError(Exception):
    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def enhance_transcript(text: str, gemini_api_key: str) -> dict:
    """
    分析转录文本，返回语言、翻译（如需）和关键词列表。
    """
    if not text or not text.strip():
        raise EnhanceServiceError(5001, "转录文本为空")

    client = genai.Client(api_key=gemini_api_key)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{_PROMPT}\n\n---\n\n{text[:8000]}",  # 限制长度
        )
        raw = response.text.strip()

        # 清理 markdown 代码块
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return {
            "language": result.get("language", "unknown"),
            "translation": result.get("translation"),
            "keywords": result.get("keywords", []),
        }

    except EnhanceServiceError:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise EnhanceServiceError(5002, "增强分析失败") from e

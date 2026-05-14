"""使用 Gemini 把转录文本切割成精听句子列表。"""

from __future__ import annotations
import json
from google import genai

_PROMPT = """
你是一个专业的语言学习内容处理助手。请把以下播客转录文本切割成适合精听练习的句子列表。

要求：
1. 每个句子保持语义完整，不要在句子中间切断
2. 每个句子长度适中（10-25个单词为宜），太长的句子可以拆分
3. 从转录文本中提取时间戳（格式如 [00:00] 或 [MM:SS]），转换为秒数
4. 如果某句没有时间戳，根据前后句子的时间戳推算
5. 为每句话提供中文翻译
6. 标注该句的难度：easy / medium / hard

严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "segments": [
    {
      "id": 1,
      "start": 0,
      "text": "原文句子",
      "translation": "中文翻译",
      "difficulty": "easy"
    }
  ]
}

注意：
- start 是该句开始的秒数（整数）
- 至少返回 5 个句子
- 最多返回 50 个句子
""".strip()


class SegmentServiceError(Exception):
    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def segment_transcript(text: str, gemini_api_key: str) -> list:
    """把转录文本切割成精听句子列表。"""
    if not text or not text.strip():
        raise SegmentServiceError(7001, "转录文本为空")

    client = genai.Client(api_key=gemini_api_key)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{_PROMPT}\n\n---\n\n{text[:6000]}",
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        result = json.loads(raw)
        return result.get("segments", [])
    except SegmentServiceError:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise SegmentServiceError(7002, "切割失败") from e

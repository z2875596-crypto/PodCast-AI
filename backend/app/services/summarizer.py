"""使用 Gemini 对转录文本生成结构化摘要。"""

from __future__ import annotations

from google import genai

_SUMMARIZE_PROMPT = """
你是一位专业的播客内容分析师。请根据以下播客转录文本，生成一份结构化摘要。

要求：
1. **核心主题**：用一句话概括本期播客的核心议题。
2. **关键要点**：列出 3-5 个最重要的观点或信息，每条简明扼要。
3. **重要结论**：总结主要结论或行动建议（如有）。
4. **适合人群**：说明哪类听众会从本期内容中获益最多。

输出格式（严格按照以下 JSON 格式，不要输出任何其他内容）：
{
  "core_topic": "一句话核心主题",
  "key_points": [
    "要点一",
    "要点二",
    "要点三"
  ],
  "conclusion": "主要结论或行动建议",
  "target_audience": "适合人群描述"
}
""".strip()


class SummarizeServiceError(Exception):
    """摘要业务错误：code 3001 文本为空，3002 摘要失败，3003 解析失败。"""

    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def summarize_transcript(text: str, gemini_api_key: str) -> dict:
    """
    对转录文本调用 Gemini 生成结构化摘要，返回解析后的字典。
    """
    if not text or not text.strip():
        raise SummarizeServiceError(3001, "转录文本为空")

    client = genai.Client(api_key=gemini_api_key)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{_SUMMARIZE_PROMPT}\n\n---\n\n{text}",
        )
        raw = response.text.strip()

        # 清理可能的 markdown 代码块标记
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        import json
        result = json.loads(raw)
        return result

    except SummarizeServiceError:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise SummarizeServiceError(3002, "摘要失败") from e

"""使用 Gemini 查询英文单词的详细信息。"""

from __future__ import annotations
import json
from google import genai

_PROMPT = """
你是一个专业的英英/英汉词典。请查询以下英文单词，提供详细信息。

严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "word": "单词原形",
  "phonetic": "/音标/",
  "definitions": [
    {
      "pos": "词性（n./v./adj./adv./prep. 等）",
      "meaning": "中文释义",
      "english_def": "简短的英文释义"
    }
  ],
  "phrases": [
    {
      "phrase": "常用短语或搭配",
      "meaning": "中文意思"
    }
  ],
  "examples": [
    {
      "en": "英文例句",
      "zh": "中文翻译"
    }
  ],
  "level": "词汇难度：beginner / intermediate / advanced"
}

要求：
- definitions 提供 1-3 个最常用的词义
- phrases 提供 2-4 个常用短语
- examples 提供 2-3 个实用例句
- 例句要自然地道，接近真实语境
""".strip()


class WordServiceError(Exception):
    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def lookup_word(word: str, gemini_api_key: str) -> dict:
    """查询单词详细信息，返回结构化字典。"""
    word = word.strip()
    if not word:
        raise WordServiceError(6001, "单词不能为空")
    if len(word) > 50:
        raise WordServiceError(6001, "输入内容过长")

    client = genai.Client(api_key=gemini_api_key)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{_PROMPT}\n\n查询单词：{word}",
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        return json.loads(raw)
    except WordServiceError:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise WordServiceError(6002, "查词失败") from e

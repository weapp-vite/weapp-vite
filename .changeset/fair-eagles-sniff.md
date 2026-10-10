---
"@wevu/web-apis": patch
---

修复 URL 查询参数包含不完整百分号转义或非法 UTF-8 字节时抛出异常，保留有效文本、替换字符和 searchParams 同步行为。

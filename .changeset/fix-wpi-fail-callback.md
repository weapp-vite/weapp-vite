---
'@wevu/api': patch
---

修复 `wpi` callback `fail` 与 Promise `catch` 错误类型不一致的问题，微信 API 的失败回调现在会保留专属错误字段并补充 `errno` 类型。

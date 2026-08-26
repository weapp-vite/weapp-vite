---
'@wevu/api': patch
---

修复 `wpi` callback 的 `success`、`fail`、`complete` 类型与微信 API 声明不一致的问题，失败回调会保留专属错误字段并补充 `errno` 类型。

---
'@wevu/api': patch
---

修复 `wpi` 的 `success`、`fail`、`complete` 以及无 callback 时 Promise 链类型与平台 API 声明不一致的问题，补充 `.then`、`.catch`、`.finally` 和 `async/await` 的全量类型校验。微信公共对象复用官方 typings，失败回调保留各平台专属错误字段，显式上游模糊类型保持原语义并仅在可识别的微信错误上补充 `errno`。

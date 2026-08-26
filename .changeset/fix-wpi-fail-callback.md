---
'@wevu/api': patch
---

修复 `wpi` callback 的 `success`、`fail`、`complete` 类型与平台 API 声明不一致的问题，微信公共对象复用官方 typings，失败回调保留各平台专属错误字段并仅在微信适配器补充 `errno` 类型。

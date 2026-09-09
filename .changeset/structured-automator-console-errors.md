---
"@weapp-vite/miniprogram-automator": patch
---

增加可选结构化日志采集，使用 CDP 数据描述符读取 Error 的非枚举消息和堆栈，避免 SDK 序列化后丢失为普通空对象。保留启动失败和断开连接前的错误证据，并按原始顺序发布单一来源日志；默认日志格式保持兼容。

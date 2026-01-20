---
"@weapp-core/logger": patch
"weapp-vite": patch
---

新增日志配置能力：支持全局 `logger.level` 与按 tag 的 `logger.tags` 过滤，并在 weapp-vite 配置中暴露 `weapp.logger`（npm 日志改由 tag 控制）。

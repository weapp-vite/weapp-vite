---
"weapp-vite": patch
---

优化 `forwardConsole` 在用户终端中的日志输出格式。小程序 `console` 转发日志现在直接以 `[mini:level] message` 单行输出，避免被 CLI logger 二次包装成额外的 `WARN` / `ERROR` 标题、时间戳和空行，同时继续保留用户终端的颜色展示与 AI 终端的无色输出。

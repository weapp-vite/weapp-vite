---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 wevu 模板开发模式热更新后内部运行时导出绑定漂移的问题，避免 `setWevuDefaults is not a function`、`createApp is not a function` 等由错误 vendor chunk 引发的运行时错误。

---
"@weapp-vite/volar": patch
---

改用轻量 SFC parser，并通过增量更新和有界缓存复用 `defineOptions` 分析结果，减少 Volar 冷启动与项目失效重建时的重复解析，提升跳转和模板语言服务的首次响应性能。

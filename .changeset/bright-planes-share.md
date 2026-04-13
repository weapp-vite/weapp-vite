---
'@weapp-vite/vscode': minor
'create-weapp-vite': minor
---

VS Code 扩展现在会检查页面 `definePageJson` 与 `<json>` 中的 `enablePullDownRefresh` 是否一致，并提供双向同步 quick fix。这样布尔类页面配置在双写场景下也能直接补齐和修正，减少页面行为配置漂移。

---
'@weapp-vite/vscode': minor
'create-weapp-vite': minor
---

VS Code 扩展现在会在检测到 `definePageJson` 与 `<json>` 的页面标题配置不一致时提供 quick fix，可直接将 `<json>` 中的 `navigationBarTitleText` 同步为 `definePageJson` 的值，减少双写配置时的手动修正成本。

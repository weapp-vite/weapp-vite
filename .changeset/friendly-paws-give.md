---
'@weapp-vite/vscode': minor
'create-weapp-vite': minor
---

VS Code 扩展现在会同时检查页面 `definePageJson` 与 `<json>` 中的 `navigationStyle` 是否一致，并提供双向同步 quick fix。无论是配置值不一致，还是某一侧缺少该字段，都可以直接在页面里完成补齐与同步。

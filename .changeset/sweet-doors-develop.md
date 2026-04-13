---
"@weapp-vite/vscode": patch
---

优化 VS Code 扩展在 Vue 页面中的页面配置 code action：当文件已经存在 `definePageJson(...)` 或 `<json>` 自定义块时，不再重复提示对应插入动作，仅在缺失时提供更明确的补齐入口，减少无效建议干扰。

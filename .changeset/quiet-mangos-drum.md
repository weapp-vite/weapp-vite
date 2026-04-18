---
'@weapp-vite/vscode': patch
---

收敛 VS Code 扩展中的页面配置工作流，新增页面与模板入口默认只推荐 `definePageJson`，不再把 `<json>` 双写同步、配置漂移筛选和相关快捷命令作为常规能力暴露；同时保留对历史 `<json>` 页面文件的兼容解析，并在同页同时存在 `definePageJson` 与 `<json>` 时给出兼容提示，帮助项目逐步迁移到单一的 `definePageJson` 配置写法。

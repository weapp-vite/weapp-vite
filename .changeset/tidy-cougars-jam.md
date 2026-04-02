---
'@weapp-vite/mcp': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite mcp` 在普通安装项目中的路径解析问题。现在 MCP 服务会优先识别 monorepo 布局，在用户项目里则回退到 `node_modules` 下已安装的 `weapp-vite` / `wevu` / `@wevu/compiler` 包路径，不再错误假设存在 `packages/weapp-vite/package.json`。同时补充安装态 CLI 入口与本地随包文档的回归覆盖，避免 `npx weapp-vite mcp` 启动时因 `ENOENT` 直接失败。

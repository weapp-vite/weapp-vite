---
'@weapp-core/schematics': patch
'@weapp-vite/mcp': patch
'@weapp-vite/web': patch
'@wevu/api': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

优化 `weapp-vite`、`@weapp-vite/mcp`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积与依赖边界：将可复用的 Node 侧运行时依赖改为走 `dependencies`，把 MCP SDK 相关实现和 transport 启动逻辑集中收敛到 `@weapp-vite/mcp`，让 `weapp-vite` 通过包内桥接复用 MCP 能力，同时继续抽取共享 chunk、移除重复声明产物，减少发布包中不必要的内联与重复代码。

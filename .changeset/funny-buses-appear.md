---
'@weapp-core/schematics': patch
'@weapp-vite/web': patch
'@wevu/api': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

优化 `weapp-vite`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积：将可复用的 Node 侧运行时依赖改为走 `dependencies`，继续外置 `weapp-vite` 中的 MCP、构建队列、输出清理与版本判断相关依赖，合并 `@weapp-vite/web` 的多入口构建以抽取共享 chunk，并移除 `@wevu/api` 中重复的声明产物，减少发布包中不必要的内联与重复代码。

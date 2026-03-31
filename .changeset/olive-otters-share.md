---
'create-weapp-vite': patch
---

更新 `weapp-vite-lib-template` 模板：为组件库项目同时补充 `@wevu/api` 的 `peerDependencies` 与 `devDependencies`，并在 lib 构建配置中将 `@wevu/api` 标记为 external，避免被打进组件库产物。

---
'weapp-vite': patch
'create-weapp-vite': patch
---

收窄 `weapp-vite` 中 `autoRoutes` 在开发模式下的热更新重扫触发条件。此前位于 `src/pages/**` 下的普通文件更新也可能触发一次路由全量重扫；现在仅在结构性变化（如新增、删除）时才对未命中的 pages 路径触发重扫，而真正的路由入口文件更新仍保持增量处理，从而减少无关文件变更对热更新速度的影响。

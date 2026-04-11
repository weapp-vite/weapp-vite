---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `app.vue` 中使用 `weapp-vite/auto-routes` 时，构建阶段提取 `defineAppJson` 宏配置会错误解析 `auto-routes` 回退路径的问题。现在打包产物会优先命中 `dist` 同级的 `auto-routes.mjs`，避免 `app.vue` 被误判为缺少应用配置，恢复 GitHub issue 场景与相关小程序项目的正常构建。

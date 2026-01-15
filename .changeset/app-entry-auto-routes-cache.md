---
"weapp-vite": patch
---

优化 dev 热更新：
- 默认启用 hmr.sharedChunks=auto，减少全量发射。
- 缓存 JSON 宏配置与依赖，避免重复 bundleRequire。
- 缓存 app 入口/共享 chunk 命名，减少重复解析与计算。
- 为 app 配置引入 auto-routes 签名缓存，并减少无关页面更新时的 app 入口解析。

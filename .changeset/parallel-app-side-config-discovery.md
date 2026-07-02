---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化应用入口加载时的侧边配置发现流程，sitemap/theme JSON 以及小程序运行时配置候选会并行探测，同时保留 source app.miniapp.json 优先于 project.miniapp.json 的既有语义。

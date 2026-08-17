---
'weapp-vite': patch
'create-weapp-vite': patch
---

新增微信分包预下载规则的显式配置合成与 `wv analyze --preload` 静态建议，帮助审计跨分包跳转并保持手写 `preloadRule` 优先。

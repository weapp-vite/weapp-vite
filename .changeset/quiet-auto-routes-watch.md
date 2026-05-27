---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 auto-routes 生成文件可能被 watch/HMR 误判为页面变更的问题，避免 `.auto-routes-*` 临时文件、typed-router 和持久缓存输出触发无限热更新。

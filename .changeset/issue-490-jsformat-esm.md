---
"weapp-vite": patch
"create-weapp-vite": patch
---

保持 `weapp.jsFormat` 默认值为 `cjs`，同时补齐 `esm` / `cjs` 双格式回归覆盖，并修复显式 `esm` 场景下请求相关全局注入缺失的问题。

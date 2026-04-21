---
"weapp-vite": minor
"create-weapp-vite": patch
---

默认将 `weapp.jsFormat` 从 `cjs` 切换为 `esm`，同时补齐 `esm` / `cjs` 双格式兼容与回归覆盖，修复默认 `esm` 场景下请求相关全局注入缺失的问题。

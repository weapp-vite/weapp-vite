---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 `weapp.chunks.preserveModules` 配置，可按 `srcRoot` 相对路径保留匹配源码模块的独立产物路径，便于调试定位和构建产物审计。

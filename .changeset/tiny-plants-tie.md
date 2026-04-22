---
"@weapp-core/constants": patch
---

为 `import.meta.env` 调试稳定性补充共享缓存 key 常量，供 `weapp-vite` 在页面与组件产物中复用同一份 env 表达式，减少调试输出行号漂移。

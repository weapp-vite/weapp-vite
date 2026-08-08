---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复构建后 npm 路径、平台 API 和动态全局对象重写继续沿用旧 sourcemap，导致原生 TypeScript 产物无法准确回溯源码位置的问题。

---
"create-weapp-vite": patch
"weapp-vite": patch
---

内置 Tailwind CSS 集成升级到 `weapp-tailwindcss@5.4.0` compiler API，支持多入口快照复用、增量失效和统一的 WXSS、WXML、JavaScript 转换；同时可通过 `weapp.tailwindcss.compiler.maxRoots` 调整编译 root 缓存上限。

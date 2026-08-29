---
"create-weapp-vite": patch
"weapp-vite": patch
---

内置 Tailwind CSS 集成升级到 `weapp-tailwindcss@5.4.1` compiler API，由 core 统一完成 WXSS 最终化并按 `@source` glob 精确处理 HMR 失效；支持多入口快照复用、统一转换 WXSS、WXML、JavaScript，以及通过 `weapp.tailwindcss.compiler.maxRoots` 和 `onRootEvicted` 管理编译 root 缓存。

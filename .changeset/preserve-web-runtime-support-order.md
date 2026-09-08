---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复启用 Web runtime prelude 时，合并共享支持模块导致循环依赖、微信开发者工具启动出现基类未初始化错误的问题。合并会改变依赖初始化顺序时保留独立模块，由 Vite 正常输出，确保 AbortSignal 等继承链在启动时可用。

---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 npm 小程序包 JS module 兼容处理，复制后的多个 JS 文件会并发读取和转换，减少文件较多依赖包的构建等待。

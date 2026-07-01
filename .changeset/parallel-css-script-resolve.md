---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化样式依赖 HMR 的脚本入口解析流程，同一层 CSS importer 会并行查找对应脚本，并缓存未命中的入口探测结果，减少样式更新时的串行文件探测等待。

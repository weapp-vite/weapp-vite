---
"weapp-vite": patch
---

优化编译阶段插件性能：为文件读取/存在性检查增加轻量缓存，减少重复 I/O；同时修复带 query 的模块 id 在核心插件中导致部分页面模板未正确扫描的问题。

- 补充 `plugins/utils/cache` 的单元测试与性能基准测试（`bench/cache.bench.ts`）。


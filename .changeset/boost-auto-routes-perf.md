---
'weapp-vite': patch
'@weapp-core/init': patch
---

- 使用 `fdir` 扫描自动路由候选并缓存共享样式结果，减少多余 IO 和重复预处理。
- 优化模板创建时的文件读写路径检测，避免额外的文件状态查询。

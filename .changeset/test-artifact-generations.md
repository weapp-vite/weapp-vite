---
"weapp-vite": patch
"create-weapp-vite": patch
"@mpcore/weapp-vite": patch
---

测试产物按进程、配置和构建批次隔离输出，并基于源码、配置依赖与产物内容验证缓存，避免源码更新后复用旧结果或覆盖仍被测试使用的产物。补齐依赖监听、连续修改合并、可等待关闭与过期缓存失败隔离。

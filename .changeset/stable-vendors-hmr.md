---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发热更新中稳定 vendor chunk 被单个页面增量构建覆盖后，其他页面仍引用旧导出名导致小程序 IDE 运行时报错的问题。

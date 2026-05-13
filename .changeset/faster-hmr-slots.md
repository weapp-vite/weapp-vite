---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下 Vue SFC 页面模板改动会沿共享 chunk 扩散到大量入口重新 emit 的问题。现在普通页面文本或作用域插槽内容更新会保持单入口增量重建，同时刷新带有模块元数据的共享 chunk 索引，避免后续 HMR 继续引用过期的共享模块归属。

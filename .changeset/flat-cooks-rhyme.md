---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强小程序文件型热更新的阶段采样与原因解释日志，新增 shared chunk 解析耗时、脏标记来源摘要与 pending 扩张原因摘要，帮助开发阶段更快定位为何触发增量或扩大量重构建。

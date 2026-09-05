---
"wevu": patch
"@weapp-core/constants": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

修复响应式 `setData` 在宿主提交失败或乱序完成后仍沿用未提交快照的问题，确保 Web 适配器可重试同值渲染；导出的 `nextTick` 继续只等待 JavaScript 与响应式调度队列，Web Options API `$nextTick` 会额外等待当前 Lit 提交。

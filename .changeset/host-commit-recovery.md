---
"wevu": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

修复响应式 `setData` 在宿主提交失败或乱序完成后仍沿用未提交快照的问题，确保 Web 适配器可重试同值渲染，并明确 `nextTick` 仅等待 JavaScript 与响应式调度队列。

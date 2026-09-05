---
"wevu": patch
"@weapp-core/constants": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

修复响应式 `setData` 在宿主提交失败或乱序完成后仍沿用未提交快照的问题，确保 Web 适配器可重试同值渲染；导出的 `nextTick` 继续只等待 JavaScript 与响应式调度队列，Web Options API `$nextTick` 会额外等待当前 Lit 提交。

原生实例 `$nextTick` 现在等待宿主提交与模板 ref 完成，ref 或原始回调失败会拒绝本轮等待但不阻止后续恢复；隐藏缓冲保留最早失败，过期 selector 回调不能覆盖新 ref。Web 实例在属性更新或 HMR 恢复后改为等待当前渲染，不再复用已经失败的旧提交。

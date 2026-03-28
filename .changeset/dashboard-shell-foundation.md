---
'@weapp-vite/dashboard': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

增强 `@weapp-vite/dashboard` 的应用壳子，新增工作台、活动流、设计令牌等页面骨架，并将现有 analyze 面板迁移为独立路由页面。现在 dashboard 具备统一导航、全局主题切换和可持续扩展的页面结构，后续接入真实 CLI 事件与诊断数据会更稳定。

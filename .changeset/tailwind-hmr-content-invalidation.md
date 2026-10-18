---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Tailwind CSS 状态化 HMR 在源码新增或删除、以及仅配置独立 CSS 入口时未触发内容失效的问题，确保新增工具类生效并移除已删除的工具类。

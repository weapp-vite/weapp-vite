---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复微信状态保持 HMR 更新 Tailwind 全局样式时页面计算样式未刷新的问题，确保页面 WXSS 随全局样式快照变化触发重新解析，同时不改变页面视觉语义。

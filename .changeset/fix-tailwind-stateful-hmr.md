---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复微信状态保持 HMR 连续更新 Tailwind 任意值时的重复构建与页面栈超时问题；缩短样式刷新合并窗口，并避免把未变化的小程序资产重复写入开发者工具，提升添加、修改和删除 Tailwind 类时的热更新速度与稳定性。

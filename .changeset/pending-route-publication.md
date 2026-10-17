---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 在自动路由尚未发布时保留迟到的结构变化通知，避免新页面已被扫描但尚未进入构建图时丢失构建和来源归因。

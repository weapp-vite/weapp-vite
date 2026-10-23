---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复 Windows 短路径与真实路径不一致导致模板更新误触 classic 回退的问题，并避免同源脚本侧车提前交付不包含执行逻辑的热更新，确保更新版本与实际事件逻辑一致。有效的原生 Vue 模板结构变化提前进入 classic，减少无效快照准备，同时保留编译错误的原始报告路径。

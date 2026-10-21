---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复原生页面或组件 JSON 配置同时被 Tailwind 扫描时未及时回退 classic 的问题，按真实配置变更原因停止旧状态保持交付，同时保留普通模板转换 JSON 依赖的快照更新与错误恢复。

---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复状态保持热更新读取固定源码快照时遗漏原生组件配置与模板的问题，避免编辑 Vue 模板后微信开发者工具因组件产物丢失而中断运行。

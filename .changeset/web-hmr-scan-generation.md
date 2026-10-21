---
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

fix(web): 修复 Web 开发模式恢复 Vue 页面时，应用与页面通知交错导致旧扫描快照保留失效模板节点并重复整页刷新的问题；热更新统一使用实际提交扫描的前后快照，保留删除组件、外部块和样式语言变化的传播。

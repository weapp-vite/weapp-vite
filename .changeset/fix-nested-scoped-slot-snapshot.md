---
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复嵌套 scoped slot 中纯原生默认内容被额外编译为 generic slot 组件后在微信开发者工具中可能卡死的问题，并避免 scoped slot 桥接字段继续发布为嵌套 owner snapshot。同步发布 create-weapp-vite，保持脚手架模板依赖版本与本次修复一致。

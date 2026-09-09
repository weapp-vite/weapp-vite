---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 的 `defineOptions` 静态求值将 `i18n.behavior` 或命名空间成员错误序列化为构建占位对象的问题，保留真实运行时行为引用，避免微信开发者工具拒绝组件注册。

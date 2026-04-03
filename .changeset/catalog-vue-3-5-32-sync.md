---
"weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"@weapp-vite/dashboard": patch
"create-weapp-vite": patch
---

同步升级 workspace catalog 与 `create-weapp-vite` 模板 catalog 中的 Vue 相关依赖版本，统一到 `3.5.32`，并刷新 `@types/node`、`@tanstack/vue-query` 及锁文件，确保工作区内发布包、示例应用与脚手架生成结果使用一致的依赖基线。

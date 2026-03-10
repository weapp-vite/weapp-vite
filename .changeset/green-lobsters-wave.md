---
'weapp-vite': patch
'create-weapp-vite': patch
---

升级 `weapp-vite` 的构建链路依赖版本，包含 `rolldown`、`oxc-parser`、`@oxc-project/types` 与 `cac`，并同步更新 `create-weapp-vite` 模板 catalog 中的 `vite`、`vue`、`@vue/compiler-core`、`@types/node` 等依赖版本，使脚手架生成项目与当前工具链版本保持一致。

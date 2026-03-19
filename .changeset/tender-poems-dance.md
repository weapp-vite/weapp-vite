---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 lib 模式下的声明生成回归。`weapp-vite` 现在在调用 `rolldown-plugin-dts` 时会自动识别带有 `references` 的 `tsconfig`，并切换到 build mode，避免 `templates/weapp-vite-lib-template` 执行 `pnpm build:lib` 时因 project references 直接失败；同时 `wevu` 补充导出 `defineComponent` 类型 props 重载相关的公开类型，避免 Vue SFC 声明生成时泄漏到不可命名的内部类型，导致组件库 dts 产物构建报错。

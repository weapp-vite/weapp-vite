---
"weapp-vite": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复了一组由类型产物路径迁移与 `defineOptions` 临时求值模块带来的回归问题。`auto-routes` 与模板相关 e2e 现已统一校准到 `.weapp-vite` 下的 `typed-router.d.ts`、`components.d.ts`、`typed-components.d.ts` 等托管产物路径，子包构建断言也改为基于稳定语义而不是压缩后的局部变量名，避免因为产物重命名导致误报。

同时，`@wevu/compiler` 生成的 `defineOptions` 临时模块不再混用 default export 与 named export，消除了构建阶段的 `MIXED_EXPORTS` 警告；仓库根 `tsconfig.json` 里的 Volar 插件声明也改为使用 `weapp-vite/volar` 包名，避免子项目继承根配置后执行 `vue-tsc` 时出现插件相对路径错位告警。这些修复会同步改善 `weapp-vite` 模板与脚手架生成项目的类型检查体验，因此一并补充 `create-weapp-vite` 的版本变更。

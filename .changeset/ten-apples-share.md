---
'create-weapp-vite': patch
---

清理并收敛 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 模板源码中的 TypeScript 与 ESLint 问题：统一模板内 Vue SFC 书写形态、修正一批服务层导入与类型冲突、补齐兼容性配置以保证模板在默认环境下可稳定通过 `typecheck`、`eslint` 与 `build`，降低初始化后首次二次开发的错误成本。

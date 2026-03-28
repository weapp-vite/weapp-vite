---
'@weapp-vite/ast': minor
---

增强 `@weapp-vite/ast` 面向多小程序平台分析场景的共享 helper 导出，补充 `platformApi`、`require`、`scriptSetupImports`、`featureFlags`、`jsxAutoComponents`、`onPageScroll`、`componentProps` 等操作中的可复用纯函数，并完善对应单元测试覆盖，便于跨 Babel/Oxc 引擎复用一致的分析能力。

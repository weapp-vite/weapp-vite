---
"@weapp-vite/ast": minor
"@weapp-vite/ast-native": minor
"@wevu/compiler": minor
"create-weapp-vite": patch
"weapp-vite": patch
---

将 SFC HMR 语义下沉到 `@wevu/compiler`，新增 script、template、style、config block 级签名与变更分类，并扩展可选 native 载荷保持同构回退。`weapp-vite` 仅保存编译器快照并继续通过 `ModuleGraphService` 传播失效；脚本文本候选分析统一由 `@weapp-vite/ast` 提供。

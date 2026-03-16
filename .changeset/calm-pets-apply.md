---
"@weapp-core/schematics": patch
"@weapp-core/shared": patch
"@weapp-core/logger": patch
"@weapp-core/init": patch
"rolldown-require": patch
"weapp-ide-cli": patch
"@weapp-vite/web": patch
"@weapp-vite/volar": patch
"create-weapp-vite": patch
"weapp-vite": patch
---

将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。

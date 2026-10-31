---
"@weapp-core/schematics": patch
"@weapp-vite/i18n": patch
"@weapp-vite/volar": patch
"weapp-vite": patch
---

fix(types): 修复双格式入口的类型声明映射，为 CommonJS 提供匹配的声明，并保持 Volar 默认插件在 import 与 require 下的类型一致。

补齐 Volar 公开声明所需的 Vue 编译器和 TypeScript 依赖，确保隔离消费者可解析完整的插件上下文和 SFC 类型。

i18n 显式引用共享的平台类型，保持原生 Page、Behavior 与标识符的类型身份，使公开入口可在严格 Node 和 DOM 环境中使用。

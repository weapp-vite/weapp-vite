---
title: '@weapp-vite/ast-native'
description: weapp-vite 的 Rust/Oxc 原生 AST 分析原型。
keywords: [weapp-vite, ast, oxc, native]
---

# @weapp-vite/ast-native

`@weapp-vite/ast-native` 是可选的 Rust/Oxc 原生 AST 分析原型。它用于受控的性能实验和内部工具验证，默认项目不需要直接依赖它。

## 安装与使用

```bash
pnpm add @weapp-vite/ast-native
```

```ts
import { analyzeScriptNative } from '@weapp-vite/ast-native'

const result = analyzeScriptNative('const count = 1', undefined, undefined, 'inline.ts')
console.log(result.featureFlags)
```

## AI 选择提示

只有在确认目标平台有对应 native 预构建产物、并且任务明确要求 native AST 性能时才选择本包。普通插件或编译器扩展优先使用 `@weapp-vite/ast`，它有更稳定的跨平台回退路径。

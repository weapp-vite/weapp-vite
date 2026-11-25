---
title: '@weapp-vite/ast-native'
description: weapp-vite 的 Rust/Oxc 原生 AST 分析包。
keywords: [weapp-vite, ast, oxc, native]
---

# @weapp-vite/ast-native

`@weapp-vite/ast-native` 是可选的 Rust/Oxc 原生 AST 分析包。根包会按运行时平台加载对应的可选平台包，支持 macOS arm64/x64、Linux arm64/x64 GNU/glibc 和 Windows arm64/x64 MSVC。Linux musl 与其他架构暂不提供原生包。

原生 AST 仍需显式启用。设置 `WEAPP_VITE_NATIVE=1`，并通过现有 `WEAPP_VITE_NATIVE_AST_PATH` 配置指向本包入口。未启用时不会加载原生模块，native 加载或执行失败时继续使用现有 JS/Oxc/Vue compiler 路径。

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

普通安装会通过可选依赖获取当前平台的预构建产物。只有在任务明确要求 native AST 性能时才启用本包。普通插件或编译器扩展优先使用 `@weapp-vite/ast`，它提供稳定的跨平台回退路径。

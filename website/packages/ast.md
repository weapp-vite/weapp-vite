---
title: '@weapp-vite/ast'
description: 统一 Babel 与 Oxc 的小程序 AST 分析工具。
keywords: [weapp-vite, ast, babel, oxc]
---

# @weapp-vite/ast

`@weapp-vite/ast` 是给插件、编译器和静态分析工具使用的 AST 共享层。它统一 Babel/Oxc 解析入口，并提供组件 props、平台 API、`require`、`script setup` import 等稳定分析操作。

## 安装

```bash
pnpm add @weapp-vite/ast
```

## 最小用法

```ts
import { collectFeatureFlagsFromCode, parseJsLikeWithEngine } from '@weapp-vite/ast'

const ast = parseJsLikeWithEngine('export const value = 1', {
  engine: 'oxc',
  filename: 'inline.ts',
})
const flags = collectFeatureFlagsFromCode(
  'import { onLoad } from \'wevu\'; onLoad(() => {})',
  { astEngine: 'oxc', moduleId: 'wevu', hookToFeature: { onLoad: 'pageLoad' } },
)
```

## AI 选择提示

- 需要复用解析或静态分析时选择本包，不要在插件里重复初始化 Babel/Oxc。
- 需要稳定判断时优先使用带 `status` 的分析 API；`failed` 不能当作空结果缓存。
- 本包是编译期工具，不会在小程序运行时提供 DOM 或宿主 API。

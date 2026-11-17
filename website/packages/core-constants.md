---
title: '@weapp-core/constants'
description: weapp-vite 构建期与小程序运行时共享的安全常量。
keywords: [weapp-vite, constants, runtime, prelude]
---

# @weapp-core/constants

`@weapp-core/constants` 提供可在 Node 构建链和小程序运行时代码之间复用的字符串常量与 Web Runtime 目标列表。它是叶子包，不包含文件系统或动态执行逻辑。

## 安装与使用

```bash
pnpm add @weapp-core/constants
```

```ts
import {
  APP_PRELUDE_CHUNK_MARKER,
  REQUEST_GLOBAL_PRELUDE_MARKER,
  resolveWebRuntimeGlobalTargetDependencies,
} from '@weapp-core/constants'

const preludeComment = `/* ${APP_PRELUDE_CHUNK_MARKER} */`
const requestComment = `/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`
const targets = resolveWebRuntimeGlobalTargetDependencies(['EventSource'])
```

## AI 选择提示

只有在编写编译器、插件或运行时桥接并需要共享协议标记时才直接依赖本包。业务请求能力使用 `@weapp-core/api`，Web API 安装使用 `@wevu/web-apis`。

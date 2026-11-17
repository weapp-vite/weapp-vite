---
title: '@weapp-core/logger'
description: weapp-vite 工具链共享的结构化终端日志封装。
keywords: [weapp-vite, logger, consola, cli]
---

# @weapp-core/logger

`@weapp-core/logger` 基于 consola 提供统一日志方法、颜色工具和按 tag 过滤。它适合 CLI、构建插件和开发工具，不负责把日志发送到远端。

## 安装与使用

```bash
pnpm add @weapp-core/logger
```

```ts
import logger, { colors, configureLogger } from '@weapp-core/logger'

configureLogger({ level: 'info', tags: { build: 'warn' } })
logger.info('Build started')
logger.withTag('build').warn('Using cached output')
logger.success(colors.green('Build complete'))
```

## AI 选择提示

统一 CLI 输出时使用本包；库的业务错误仍应通过返回值或抛错表达，不要把日志输出当成 API 契约。

# @weapp-core/logger

## 简介

`@weapp-core/logger` 是基于 consola 的日志封装，提供全局级别控制与按 tag 的细粒度过滤，适合在 weapp-vite 相关工具链中统一输出风格。

## 特性

- 全局日志级别控制
- 按 tag 覆盖日志级别
- API 兼容 consola 的常用用法
- 内置 `picocolors`，统一终端文本染色

## 安装

```bash
pnpm add @weapp-core/logger
```

## 使用

```ts
import logger, { colors, configureLogger } from '@weapp-core/logger'

configureLogger({
  level: 'info',
  tags: {
    build: 'warn',
  },
})

logger.info('Hello')
logger.withTag('build').warn('Build warning')

logger.success(colors.green('Build done'))
```

## 配置

`configureLogger` 选项：

- `level`：全局日志级别（`info` / `warn` / `error` / `silent`）
- `tags`：按 tag 覆盖级别

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite

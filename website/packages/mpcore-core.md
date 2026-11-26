---
title: '@mpcore/core'
description: mpcore 小程序工具生态的核心入口与稳定元信息。
keywords: [mpcore, mini-program, testing]
---

# @mpcore/core

`@mpcore/core` 是 mpcore 生态的核心入口包，当前提供生态标识和元信息导出。页面测试通常应从 `@mpcore/test` 开始，只有需要构建 provider 或识别 mpcore 生态时才直接使用本包。

## 安装

```bash
pnpm add -D @mpcore/core
```

## 最小用法

```ts
import { MPCORE_ECOSYSTEM, MPCORE_PACKAGE_NAME } from '@mpcore/core'

console.log(MPCORE_PACKAGE_NAME, MPCORE_ECOSYSTEM.packageName)
```

## AI 选择提示

它不是页面渲染器，也不是测试断言库。weapp-vite 项目优先使用 `weapp-vite/test`、`weapp-vite/e2e` 和 Vitest 原生 API；需要 watch 构建注入时再选用 `@mpcore/vitest`。

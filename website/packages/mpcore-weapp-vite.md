---
title: '@mpcore/weapp-vite'
description: 把真实 weapp-vite 构建产物接入 mpcore 测试。
keywords: [mpcore, weapp-vite, testing, artifact]
---

# @mpcore/weapp-vite

`@mpcore/weapp-vite` 是 `@mpcore/test` 的产物适配器。它使用真实 weapp-vite 构建流程生成不可变测试代次，再交给 headless runtime 执行。

## 安装

```bash
pnpm add -D @mpcore/test @mpcore/weapp-vite
```

## 最小用法

```ts
import { createWeappViteTestProject } from '@mpcore/weapp-vite'

const project = await createWeappViteTestProject({ cwd: process.cwd() })
const result = await project.renderPage('/pages/index/index')
await project.close()
```

## AI 选择提示

不要把源码目录直接交给 simulator；先通过本包生成产物。并发测试不要共享显式 `outDir`，默认使用隔离的 `.weapp-vite/test-artifacts/`。

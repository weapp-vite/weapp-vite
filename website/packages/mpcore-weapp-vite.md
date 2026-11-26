---
title: '@mpcore/weapp-vite'
description: 把真实 weapp-vite 构建产物接入 mpcore 测试。
keywords: [mpcore, weapp-vite, testing, artifact]
---

# @mpcore/weapp-vite

`@mpcore/weapp-vite` 是兼容包，提供 `/test` 与 `/e2e` 子路径。`/test` 暴露产物构建、缓存、headless 测试项目、查询和交互 API，`/e2e` 暴露 IDE automator API。新项目不需要安装这个适配包，直接使用 `weapp-vite` 的两个 namespace。

## 安装

```bash
pnpm add -D @mpcore/weapp-vite
```

新项目通常直接依赖 `weapp-vite`，从 `weapp-vite/test` 导入产物构建和 headless simulator API，从 `weapp-vite/e2e` 导入 IDE automator API，无需额外适配包。已有项目若仍依赖本包，也可以分别从 `@mpcore/weapp-vite/test` 和 `@mpcore/weapp-vite/e2e` 导入。

## 最小用法

```ts
import { buildWeappViteTestArtifact, createTestProject } from '@mpcore/weapp-vite/test'

const artifact = await buildWeappViteTestArtifact({ cwd: process.cwd() })
const project = createTestProject({ artifact })
const result = await project.renderPage('/pages/index/index')
await project.close()
```

## AI 选择提示

不要把源码目录直接交给 simulator；先通过 `/test` 入口生成产物并创建 project。真实 DevTools automator 使用 `/e2e` 入口。并发测试不要共享显式 `outDir`，默认使用隔离的 `.weapp-vite/test-artifacts/`。`/test` 还导出 `createWeappViteTestProject` 组合 API，根入口继续转发旧 API 供兼容。

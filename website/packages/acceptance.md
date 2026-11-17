---
title: '@weapp-vite/acceptance'
description: 编排小程序构建、运行时检查和可审计证据的底层包。
keywords: [weapp-vite, acceptance, evidence, ci]
---

# @weapp-vite/acceptance

`@weapp-vite/acceptance` 提供确定性的验收步骤和报告模型，供 `weapp-agent`、CI 和仓库内工具复用。它本身不替代构建器或 DevTools。

## 安装

```bash
pnpm add -D @weapp-vite/acceptance
```

## 选择入口

应用项目优先使用 `weapp-agent` 或仓库已有的 `wv` 命令；只有需要自定义验收编排、读取结构化报告或实现新的 provider 时才直接导入本包。

```ts
import { AcceptanceService } from '@weapp-vite/acceptance'

const service = await AcceptanceService.create(process.cwd())
console.log(await service.inspect())
await service.close()
```

## AI 选择提示

把 `unknown`、`blocked`、`failed` 和 `passed` 分开记录，不要用“命令执行成功”代替真实 runtime 证据。

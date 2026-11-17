---
title: '@weapp-vite/devtools-runtime'
description: weapp-vite 仓库共享的微信开发者工具 runtime 自动化辅助层。
keywords: [weapp-vite, devtools, runtime, automation]
---

# @weapp-vite/devtools-runtime

`@weapp-vite/devtools-runtime` 为仓库内的 DevTools provider、MCP 和 E2E 共享连接、日志与资源生命周期辅助函数。普通业务项目应使用 `weapp-ide-cli` 或 `wv`，不需要直接依赖它。

## 安装与使用

```bash
pnpm add -D @weapp-vite/devtools-runtime
```

```ts
import type { DevtoolsRuntimeHooks } from '@weapp-vite/devtools-runtime'
import { withMiniProgram } from '@weapp-vite/devtools-runtime'

declare const hooks: DevtoolsRuntimeHooks

await withMiniProgram(hooks, {
  projectPath: './dist/build/mp-weixin',
  sharedSession: true,
}, async (miniProgram) => {
  await miniProgram.reLaunch('/pages/index/index')
  return await miniProgram.currentPage()
})
```

## AI 选择提示

需要截图、对比或日志时优先 `wv screenshot`、`wv compare`、`wv ide logs --open`。直接使用本包意味着你正在编写 provider 或仓库级自动化。

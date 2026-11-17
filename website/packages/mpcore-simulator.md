---
title: '@mpcore/simulator'
description: 不启动微信开发者工具即可执行小程序产物的 headless runtime。
keywords: [mpcore, simulator, headless, e2e]
---

# @mpcore/simulator

`@mpcore/simulator` 直接执行构建后的小程序产物，提供 `App`、`Page`、`Component`、`wx`、页面查询和交互句柄。它适合 CI 和本地 headless 验收；写业务测试时优先使用上层 `@mpcore/test`。

## 安装

```bash
pnpm add -D @mpcore/simulator
```

## 最小用法

```ts
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '@mpcore/simulator'

const files = createBrowserVirtualFiles([
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({ data: { message: "ready" } })'],
  ['pages/index/index.wxml', '<view>{{message}}</view>'],
])
const session = createBrowserHeadlessSession({ files })
try {
  session.reLaunch('/pages/index/index')
  console.log(session.renderCurrentPage().wxml)
}
finally {
  session.close()
}
```

## AI 选择提示

先构建真实产物，再创建 session。`@mpcore/simulator` 不等于真实微信 IDE；需要 DevTools 行为时使用 `weapp-ide-cli` 或 automator，并保留两者的证据边界。

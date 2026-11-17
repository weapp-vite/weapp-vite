---
title: '@weapp-vite/hmr'
description: 小程序宿主共享的编译批次、资产提交和交付协调内核。
keywords: [weapp-vite, hmr, plugin, host]
---

# @weapp-vite/hmr

`@weapp-vite/hmr` 是宿主插件和 runtime 共用的 HMR 协调层，负责批次、资产提交、source map 和交付状态。它是底层集成包，业务项目通常通过 `weapp-vite` 间接使用。

## 安装与使用

```bash
pnpm add @weapp-vite/hmr
```

```ts
import { HmrDeliveryCoordinator } from '@weapp-vite/hmr'

const coordinator = new HmrDeliveryCoordinator(error => host.reportHmrError(error))
coordinator.enqueue({
  prepare: async () => ({
    commit: () => host.commit(batch),
    publish: () => host.publish(batch),
  }),
})
await coordinator.whenSettled()
await coordinator.close()
```

## AI 选择提示

只有在实现新的小程序宿主或 Vite 插件时才直接使用本包。不要在业务代码里自行写一套 watcher、批次或输出提交协议；实验 API 发布应用前必须用真实 DevEngine 验证。

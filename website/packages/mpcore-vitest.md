---
title: '@mpcore/vitest'
description: 将 mpcore 小程序测试会话接入 Vitest 5。
keywords: [mpcore, vitest, testing]
---

# @mpcore/vitest

`@mpcore/vitest` 提供 Vitest 5 插件、预配置的 `test`/`it` 和 Vitest 原生 `expect`。每个测试自动获得独立的小程序 runtime，watch 模式只重跑受影响项目。

## 安装

```bash
pnpm add -D @mpcore/vitest @mpcore/weapp-vite vitest
```

## 配置与测试

```ts
// vitest.config.ts
import { mpcoreTest } from '@mpcore/vitest/config'
import { buildWeappViteTestArtifact } from '@mpcore/weapp-vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [mpcoreTest({
    artifact: { build: () => buildWeappViteTestArtifact({ cwd: process.cwd(), platform: 'weapp' }) },
  })],
})
```

```ts
import { expect, test } from '@mpcore/vitest'

test('renders home', async ({ mpcore }) => {
  const result = await mpcore.renderPage('/pages/index/index')
  expect(result.screen.getByText('ready')).toBeInTheMiniProgram()
})
```

## AI 选择提示

不要在测试里手动启动第二个 Vitest worker 或复用跨测试 session；把产物构建交给 `artifact` 配置。

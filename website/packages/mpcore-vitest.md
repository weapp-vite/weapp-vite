---
title: '@mpcore/vitest'
description: 将 mpcore 小程序测试会话接入 Vitest 5。
keywords: [mpcore, vitest, testing]
---

# @mpcore/vitest

`@mpcore/vitest` 提供可选的 Vitest 5 集成插件。它不替换 Vitest 的 `test`、`it`、`expect` 或 `describe`。新模板可直接使用 `weapp-vite/test`、`weapp-vite/e2e` 和 Vitest 原生 API。

## 安装

```bash
pnpm add -D weapp-vite vitest @mpcore/vitest
```

只使用 Vitest 原生 API 和 headless simulator 时，无需安装 `@mpcore/vitest`，直接从 `weapp-vite/test` 导入对应能力即可。需要真实 DevTools automator 时再从 `weapp-vite/e2e` 导入。

## 配置与测试

```ts
// vitest.config.ts
import { mpcoreTest } from '@mpcore/vitest/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [mpcoreTest({
    artifact: {
      build: () => import('weapp-vite/test').then(({ buildTestArtifact }) => buildTestArtifact({ cwd: import.meta.dirname })),
      watch: callbacks => import('weapp-vite/test').then(({ watchTestArtifact }) => watchTestArtifact({ cwd: import.meta.dirname, ...callbacks })),
    },
  })],
})
```

```ts
import { createVitestProject } from '@mpcore/vitest'
import { expect, test } from 'vitest'

test('renders home', async () => {
  const project = createVitestProject()
  const result = await project.renderPage('/pages/index/index')
  expect(result.screen.getByText('ready')).toBeInTheMiniProgram()
})
```

## AI 选择提示

不要在测试里手动启动第二个 Vitest worker 或复用跨测试 session；把产物构建交给 `artifact` 配置。

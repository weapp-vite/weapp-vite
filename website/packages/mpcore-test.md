---
title: 小程序页面与组件测试
description: 使用 mpcore、Vitest 与 weapp-vite 真实编译产物测试微信小程序页面和组件。
keywords:
  - mpcore
  - 小程序测试
  - 微信小程序
  - Vitest
  - weapp-vite
  - 组件测试
---

# 小程序页面与组件测试

mpcore 测试环境直接执行微信小程序编译产物，模拟微信宿主与逻辑 WXML 树。它不是 jsdom，不暴露浏览器 `document/window`，因此断言关注页面数据、生命周期、组件 properties/observer、事件和逻辑节点。

## 包职责

| 包                   | 职责                                                       |
| -------------------- | ---------------------------------------------------------- |
| `@mpcore/simulator`  | 编译产物执行、微信宿主、生命周期与资源调度内核             |
| `@mpcore/test`       | 页面/组件 render、查询、交互、mock、diagnostics 与 matcher |
| `@mpcore/vitest`     | matcher 注册、每测试 session 与自动 cleanup                |
| `@mpcore/weapp-vite` | 通过 `weapp-vite/test` 构建并缓存真实测试产物              |

## 示例

```ts
const project = await createWeappViteTestProject({ cwd: process.cwd() })
const result = await project.renderComponent('components/counter/index', {
  properties: { value: 1 },
  slots: { default: '<text>计数器</text>' },
})

await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
expect(result.screen.getByText('2')).toBeInTheMiniProgram()
expect(result).toHaveEmitted('change', { value: 2 })
```

查询支持 `ByText`、`ByRole`、`ByTestId`、`ByAttribute`、`within()` 与同步/异步变体。交互支持 `tap/input/change/blur/trigger`。不提供依赖 CSS layout 的可见性断言。

默认在 `.weapp-vite/test-artifacts/` 下按进程、配置和构建批次创建独立产物。缓存检查源码、配置、编译依赖和产物内容；新构建不会覆盖仍被测试使用的批次。显式 `outDir` 由调用方保证不被并发构建或运行中的测试共享。全部测试关闭后可清理生成目录。冷构建和 watch 重建都通过 Vite/Rolldown 写产物，保留真实分包、chunk 和编译结果。

## Vitest 与 Vite+ 测试

配置文件使用不加载测试运行时的 `@mpcore/vitest/config` 入口：

```ts
import { mpcoreTest } from '@mpcore/vitest/config'
import { buildWeappViteTestArtifact, watchWeappViteTestArtifact } from '@mpcore/weapp-vite'
import { defineConfig } from 'vitest/config'

const options = { cwd: import.meta.dirname }

export default defineConfig({
  plugins: [mpcoreTest({
    artifact: {
      build: () => buildWeappViteTestArtifact(options),
      watch: callbacks => watchWeappViteTestArtifact({ ...options, ...callbacks }),
    },
  })],
})
```

测试文件使用 fixture 自动创建、关闭每个测试的独立运行时：

```ts
import { createMpcoreTest } from '@mpcore/vitest'

const test = createMpcoreTest()

test('首页', async ({ mpcore, expect }) => {
  const page = await mpcore.renderPage('/pages/index/index')
  expect(page.screen.getByText('欢迎')).toBeInTheMiniProgram()
})
```

一次性执行只构建一次。watch 监听源码、配置依赖和编译模块图，完整产物发布后只重新运行所属测试项目；退出会等待构建和回调完成，并释放自己的监听资源。Vite+ 项目沿用同一配置与 `vp test` 所提供的 Vitest 实例，不由适配器另起 runner。

Vitest 源码覆盖率、生成的小程序 JS 覆盖率和模拟器自身覆盖率应分别记录；不能将模拟器被执行的代码量当成业务源码覆盖率。真实微信宿主的行为仍需开发者工具验收。

## worker 测试

`@mpcore/simulator` 的 Node 与浏览器执行器可运行编译后的 worker，支持 CommonJS 依赖、双向消息复制与终止。测试项目沿用 `app.json.workers`；页面卸载时应终止自己创建的 worker。首条消息、消息往返及重新进入页面后的状态有真实微信 IDE 对照。此能力验证消息与生命周期语义，不用于评估并行线程性能或系统进程回收。

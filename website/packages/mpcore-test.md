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
  events: ['change'],
})

await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
expect(result.screen.getByText('2')).toBeInTheMiniProgram()
expect(result).toHaveEmitted('change', { value: 2 })
```

查询支持 `ByText`、`ByRole`、`ByTestId`、`ByAttribute`、`within()` 与同步/异步变体。交互支持 `tap/input/change/blur/trigger`。不提供依赖 CSS layout 的可见性断言。

默认在 `.weapp-vite/test-artifacts/` 下按进程、配置和构建批次创建独立产物。缓存检查源码、配置、编译依赖和产物内容；新构建不会覆盖仍被测试使用的批次。显式 `outDir` 由调用方保证不被并发构建或运行中的测试共享。全部测试关闭后可清理生成目录。冷构建和 watch 重建都通过 Vite/Rolldown 写产物，保留真实分包、chunk 和编译结果。

## 组件更新、替身与事件

组件在内存宿主页中挂载。`setProperties()` 经过宿主的属性绑定更新同一个组件实例，保留组件内部状态并执行属性 observer；`setData()` 更新组件自身数据。两者完成后会刷新查询树。

```ts
await result.setProperties({ value: 3 })
await result.setData({ expanded: true })

const received: unknown[] = []
const unsubscribe = result.on('change', detail => received.push(detail))
await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
unsubscribe()
```

事件必须显式登记：`events: ['change']` 从挂载开始收集；`on: { change(detail, event) {} }` 同时收集并回调；挂载后 `result.on('change')` 可只启用收集。`off()` 取消订阅，`emitted('change')` 保留已记录的 detail。动态订阅不会重新挂载组件。

复杂子组件可在当前渲染内按标签名递归替换，既支持编译后的替代组件路径，也支持纯声明式替身：

```ts
const result = await project.renderComponent('components/profile/index', {
  usingComponents: {
    'remote-avatar': {
      properties: { label: '' },
      data: { ready: true },
      template: '<text>{{label}}</text><slot />',
    },
    'remote-panel': '/components/local-panel/index',
  },
})
```

`properties` 指定替身属性的默认值；省略 `template` 时使用 `<slot />`。替换通过当前渲染的内存 artifact overlay 完成，磁盘编译产物及其他渲染会话不受影响。

`unmount()` 触发组件卸载并保留测试会话，适合断言 detached 生命周期和清理结果；`close()` 关闭整个渲染会话。`project.close()` 统一释放该项目仍打开的渲染。

## 查询与稳定快照

保留的 `screen.within(node)` 与根 screen 共享最新快照，交互和显式更新后可继续查询。作用域按原 runtime `nodeId` 确定范围；该 ID 缺失时查询报错，不会按相同 test id 重定位。runtime 可能在条件节点恢复等情况下复用同一路径的 `nodeId`，此时保留的节点和作用域会解析到当前快照中该 ID 对应的节点。

`@mpcore/vitest` 自动注册语义树 serializer，可直接审阅页面或局部节点的 snapshot：

```ts
expect(result.screen).toMatchSnapshot()
expect(result.screen.getByTestId('counter')).toMatchSnapshot()
```

使用其他 runner 时，可注册 `@mpcore/test` 导出的 `mpcoreSnapshotSerializer`，或显式调用 `toMiniProgramSnapshot(screenOrNodeOrPageSnapshot)` 得到普通对象。稳定快照保留标签、排序后的公开属性、文本、事件绑定类型及子树；过滤内部 runtime ID 和样式作用域标记，并将 handler 名归一为 `[handler]`，避免编译 helper 改名导致快照漂移。`page.snapshot()` 继续返回完整诊断数据。

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

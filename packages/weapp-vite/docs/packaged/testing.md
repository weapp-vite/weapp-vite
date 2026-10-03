# 小程序页面与组件测试

`@mpcore/test` 直接执行小程序编译产物，提供逻辑 WXML 查询、交互、宿主 mock 和诊断。它不会伪造浏览器 `document/window`。

如果只需要验证 Wevu 组件的 setup、props、data、computed、methods、watch、emits、provide/inject 和生命周期，可以使用 `@wevu/test-utils` 的 `mountComponent()`。在 Vitest 配置中加入 `wevuSfc()` 后即可直接导入 `.vue` SFC：

```ts
import { wevuSfc } from '@wevu/test-utils/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [wevuSfc()],
})
```

每次 `mountComponent()` 都会创建独立的 Wevu app context，因此 `global.provide`、插件、mocks、全局属性和卸载状态不会在 wrapper 之间共享。

该入口只编译并执行 SFC script，不渲染模板、WXML、CSS 或 DOM；`app.vue` 和页面组件也不属于测试对象。默认页面判定允许 `pages/**/components/**` 中的普通组件；使用自定义页面目录时，可通过 `wevuSfc({ isPage: filename => boolean })` 提供同步或异步判定。完整编译产物、WXML 查询、组件树、宿主 mock 和用户交互仍使用 `@mpcore/test`。

## 接入

```ts
import { mpcoreTest } from '@mpcore/vitest/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [mpcoreTest()],
})
```

使用 `@mpcore/weapp-vite` 构建并缓存测试产物：

```ts
import { createWeappViteTestProject } from '@mpcore/weapp-vite'

const project = await createWeappViteTestProject({ cwd: process.cwd() })
const result = await project.renderPage('/pages/index/index?source=test')
```

默认在 `.weapp-vite/test-artifacts/` 下按进程、配置和构建批次创建独立产物。缓存同时检查源码、配置、编译依赖和产物内容；新构建不会覆盖正在运行的测试所用批次。显式 `outDir` 由调用方负责避免并发共享。所有测试关闭后，可以清理这个生成目录。

构建调用 `weapp-vite/test` 程序化入口，最终文件仍由 Vite/Rolldown emit；不会启动 CLI 或由测试适配器手写 bundle。`isTestArtifactCurrent(artifact)` 可检查当前进程生成的产物是否仍然有效。

## Vitest watch 联动

在配置中显式接入产物构建和监听：

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

测试文件从 `@mpcore/vitest` 导入 `createMpcoreTest()`，无参调用会使用当前 runner 提供的完整产物，每个测试创建独立运行时。一次性执行只构建一次；watch 在源码、配置及编译依赖重建完成后重新运行所属测试项目。退出会等待进行中的构建并关闭监听。不要从测试配置导入包含 fixture 的根入口，配置入口使用 `/config`。

Vitest 的源码覆盖率、生成的小程序 JS 覆盖率和模拟器自身覆盖率属于不同观察面；此适配不会把它们自动合并成业务源码覆盖率。

## 组件

`renderComponent()` 通过内存 overlay 注入测试宿主页，组件和依赖仍来自真实产物。支持 properties、静态 WXML slots 与事件监听。

每次测试应拥有独立 project/session，并在结束时 `close()`。`createMpcoreTest()` fixture 和 `createVitestProject()` 会自动注册清理，适用于 `test.concurrent`。

## 边界

- 不断言 CSS layout 或像素可见性。
- 未配置或未匹配的宿主 mock 应视为错误。
- 未捕获异常和 `console.error` 默认失败，warning 可通过 diagnostics 断言。
- 与微信平台语义相关的新增行为仍需用真实开发者工具校准。

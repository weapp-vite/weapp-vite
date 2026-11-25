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

页面与组件测试需要 Vitest 时，测试文件直接从 `vitest` 导入 `describe`、`it`、`test`、`expect` 等 API。产物与 headless simulator 从 `weapp-vite/test` 导入，IDE automator 从 `weapp-vite/e2e` 导入：

```ts
import { beforeAll, expect, it } from 'vitest'
import { buildTestArtifact, createTestProject } from 'weapp-vite/test'

let artifact: Awaited<ReturnType<typeof buildTestArtifact>>
beforeAll(async () => {
  artifact = await buildTestArtifact({ cwd: import.meta.dirname })
})

it('renders a page', async () => {
  const project = createTestProject({ artifact })
  try {
    const result = await project.renderPage('/pages/index/index?source=test')
    expect(result.screen.getByText('ready').textContent).toContain('ready')
  }
  finally {
    await project.close()
  }
})
```

默认在 `.weapp-vite/test-artifacts/` 下按进程、配置和构建批次创建独立产物。缓存同时检查源码、配置、编译依赖和产物内容；新构建不会覆盖正在运行的测试所用批次。显式 `outDir` 由调用方负责避免并发共享。所有测试关闭后，可以清理这个生成目录。

构建调用 `weapp-vite/test` 程序化入口，最终文件仍由 Vite/Rolldown emit；不会启动 CLI 或由测试适配器手写 bundle。`isTestArtifactCurrent(artifact)` 可检查当前进程生成的产物是否仍然有效。

## Vitest watch 联动

需要直接观察或监听构建产物时，使用 `weapp-vite/test` 导出的 API。真实微信开发者工具 automator 从 `weapp-vite/e2e` 导入：

```ts
import { launchAutomator } from 'weapp-vite/e2e'
import { buildTestArtifact, watchTestArtifact } from 'weapp-vite/test'
```

一次性执行只构建一次；watch 在源码、配置及编译依赖重建完成后发布新的构建代次。退出时关闭返回的 watcher。

真实微信开发者工具运行由仓库 `e2e/ide` 的 provider-compatible suites 承担，同一场景通过 headless provider 和 DevTools 配置运行。模板本身不添加 acceptance 配置或专用测试依赖。

Vitest 的源码覆盖率、生成的小程序 JS 覆盖率和模拟器自身覆盖率属于不同观察面；此适配不会把它们自动合并成业务源码覆盖率。

## 组件

`renderComponent()` 通过内存 overlay 注入测试宿主页，组件和依赖仍来自真实产物。支持 properties、静态 WXML slots 与事件监听。

每次测试应拥有独立 project/session，并在结束时 `close()`。需要并发测试时，为每个测试创建独立项目实例。

## 边界

- 不断言 CSS layout 或像素可见性。
- 未配置或未匹配的宿主 mock 应视为错误。
- 未捕获异常和 `console.error` 默认失败，warning 可通过 diagnostics 断言。
- 与微信平台语义相关的新增行为仍需用真实开发者工具校准。

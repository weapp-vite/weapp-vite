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

该入口只编译并执行 SFC script，不渲染模板、WXML、CSS 或 DOM；`app.vue` 和页面组件也不属于测试对象。完整编译产物、WXML 查询、组件树、宿主 mock 和用户交互仍使用 `@mpcore/test`。

## 接入

```ts
import { mpcoreTest } from '@mpcore/vitest'
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

默认产物目录为 `.weapp-vite/test-artifacts/`。构建调用 `weapp-vite/test` 程序化入口，最终文件仍由 Vite/Rolldown emit；不会启动 CLI 或由测试适配器手写 bundle。

## 组件

`renderComponent()` 通过内存 overlay 注入测试宿主页，组件和依赖仍来自真实产物。支持 properties、静态 WXML slots 与事件监听。

每次测试应拥有独立 project/session，并在结束时 `close()`。`createMpcoreTest()` fixture 和 `createVitestProject()` 会自动注册清理，适用于 `test.concurrent`。

## 边界

- 不断言 CSS layout 或像素可见性。
- 未配置或未匹配的宿主 mock 应视为错误。
- 未捕获异常和 `console.error` 默认失败，warning 可通过 diagnostics 断言。
- 与微信平台语义相关的新增行为仍需用真实开发者工具校准。

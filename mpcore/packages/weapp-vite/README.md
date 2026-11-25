# @mpcore/weapp-vite

Compatibility adapter for existing `@mpcore/weapp-vite` consumers. The `/test` entry exposes artifact build APIs, cache helpers, and headless project testing APIs, while `/e2e` exposes the IDE automator entry. New projects can import those `weapp-vite` namespaces directly without installing this adapter.

```ts
import { buildWeappViteTestArtifact, createTestProject } from '@mpcore/weapp-vite/test'

const artifact = await buildWeappViteTestArtifact({ cwd: process.cwd() })
const project = createTestProject({ artifact })
try {
  const result = await project.renderPage('/pages/index/index')
  console.log(result.screen.getByText('ready').textContent)
}
finally {
  await project.close()
}
```

`/test` 提供 `createWeappViteTestProject`、产物构建与缓存 API，以及 `@mpcore/test` 的页面/组件渲染、查询和交互 API。`/e2e` 只提供 IDE automator API。根入口继续转发旧 API，供已有项目兼容；新代码按职责使用两个子路径。

Cold builds emit immutable generations under `.weapp-vite/test-artifacts/`, isolated by process and build configuration. Repeated calls validate source, configuration, compiler dependencies and output contents before reusing an artifact. Rebuilding never overwrites a generation still used by a test. An explicit `outDir` opts into a caller-owned output directory; do not share that directory between concurrent builds or running tests.

Watch mode follows source files, configuration dependencies and the compiler module graph, then publishes a complete bundler-owned generation before calling `onRebuilt`. Changes during a build coalesce into a follow-up build. `close()` waits for any active build and callback, prevents late notifications, and releases only its own watcher. Generated generations remain available until the caller cleans the project’s `.weapp-vite/test-artifacts/` directory after all tests have closed.

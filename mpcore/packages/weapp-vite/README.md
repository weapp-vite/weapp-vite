# @mpcore/weapp-vite

Builds real weapp-vite output for `@mpcore/test` through the programmatic `weapp-vite/test` API.

```ts
import { createWeappViteTestProject } from '@mpcore/weapp-vite'

const project = await createWeappViteTestProject({ cwd: process.cwd() })
const result = await project.renderPage('/pages/index/index')
```

Cold builds emit immutable generations under `.weapp-vite/test-artifacts/`, isolated by process and build configuration. Repeated calls validate source, configuration, compiler dependencies and output contents before reusing an artifact. Rebuilding never overwrites a generation still used by a test. An explicit `outDir` opts into a caller-owned output directory; do not share that directory between concurrent builds or running tests.

Watch mode follows source files, configuration dependencies and the compiler module graph, then publishes a complete bundler-owned generation before calling `onRebuilt`. Changes during a build coalesce into a follow-up build. `close()` waits for any active build and callback, prevents late notifications, and releases only its own watcher. Generated generations remain available until the caller cleans the project’s `.weapp-vite/test-artifacts/` directory after all tests have closed.

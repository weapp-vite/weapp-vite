# @mpcore/weapp-vite

Builds real weapp-vite output for `@mpcore/test` through the programmatic `weapp-vite/test` API.

```ts
import { createWeappViteTestProject } from '@mpcore/weapp-vite'

const project = await createWeappViteTestProject({ cwd: process.cwd() })
const result = await project.renderPage('/pages/index/index')
```

Cold builds emit to `.weapp-vite/test-artifacts/`. Repeated calls reuse a valid artifact, while watch mode performs a complete bundler-owned rebuild after source changes.

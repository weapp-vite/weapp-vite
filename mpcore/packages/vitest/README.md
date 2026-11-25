# @mpcore/vitest

Vitest 5 integration for `@mpcore/test`. Import the configuration plugin from `@mpcore/vitest/config`; this entry does not replace Vitest's `expect`, `test`, `it` or `describe`. Test files should import those APIs directly from `vitest` and use `createVitestProject()` or the lower-level `@mpcore/test` APIs explicitly.

Configure an explicit artifact factory. The integration does not depend on a particular compiler; for weapp-vite:

```ts
// vitest.config.ts
import { mpcoreTest } from '@mpcore/vitest/config'
import { defineConfig } from 'vitest/config'
import { buildTestArtifact, watchTestArtifact } from 'weapp-vite/test'

const options = { cwd: import.meta.dirname }

export default defineConfig({
  plugins: [mpcoreTest({
    artifact: {
      build: () => buildTestArtifact(options),
      watch: callbacks => watchTestArtifact({ ...options, ...callbacks }),
    },
  })],
})
```

Run mode calls `build` once per project. Watch mode calls `watch` instead; the returned watcher owns its initial build and exposes that artifact. After a successful update, the plugin provides the new artifact and asks the current runner to rerun only that project's specifications. Build and scheduling errors are recorded and printed by the runner. Closing waits for startup, pending updates and the owned watcher; it does not start or stop another test process.

Vite+ uses the same plugin and `vp test`; import `defineConfig` from `vite-plus` in that host's configuration and keep its Vitest peer aligned with the runner.

Create an isolated mini-program project inside each native Vitest test. `createVitestProject()` reads the artifact injected by the plugin and closes the project when its test finishes:

```ts
import { createVitestProject } from '@mpcore/vitest'
import { expect, test } from 'vitest'

test('renders a page', async () => {
  const project = createVitestProject()
  const result = await project.renderPage('/pages/index/index')
  expect(result.screen.getByText('ready')).toBeInTheMiniProgram()
})
```

`createVitestProject({ artifact: { projectPath: process.cwd() } })` accepts an existing artifact directly. Optional host mocks and `failOnConsoleError` can be passed without replacing the injected artifact. Calling it without a configured or explicit artifact reports an actionable error. New weapp-vite projects can import artifact and simulator APIs from `weapp-vite/test`, then import DevTools automator APIs from `weapp-vite/e2e`, without installing this integration package.

Setup also registers the semantic tree snapshot serializer from `@mpcore/test`. Use `expect(result.screen).toMatchSnapshot()` or snapshot an individual node. Snapshots preserve public tree and event-binding semantics while removing runtime IDs, style scope markers and generated handler names. Full diagnostic snapshots returned by `page.snapshot()` remain unchanged; use `toMiniProgramSnapshot()` explicitly to serialize one.

Matcher types can coexist with `@vitest/browser/matchers` in projects sharing a TypeScript program. Mini-program `toHaveTextContent` preserves partial string and regular expression matching, and accepts numeric text, an omitted value to check for nonempty content, and explicit `{ normalizeWhitespace: true }`. DOM assertions continue to use Vitest's browser implementation.

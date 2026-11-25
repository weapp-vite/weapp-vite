# @mpcore/vitest

Vitest 5 integration for `@mpcore/test`. Import the configuration plugin from `@mpcore/vitest/config`; test files import the preconfigured `test` and native `expect` from `@mpcore/vitest`, using the same Vitest peer instance as setup and matchers.

Configure an explicit artifact factory. The integration does not depend on a particular compiler; for weapp-vite:

```ts
// vitest.config.ts
import { mpcoreTest } from '@mpcore/vitest/config'
import { buildWeappViteTestArtifact, watchWeappViteTestArtifact } from '@mpcore/weapp-vite'
import { defineConfig } from 'vitest/config'

const options = { cwd: import.meta.dirname, platform: 'weapp' as const }

export default defineConfig({
  plugins: [mpcoreTest({
    artifact: {
      build: () => buildWeappViteTestArtifact(options),
      watch: callbacks => watchWeappViteTestArtifact({ ...options, ...callbacks }),
    },
  })],
})
```

Run mode calls `build` once per project. Watch mode calls `watch` instead; the returned watcher owns its initial build and exposes that artifact. After a successful update, the plugin provides the new artifact and asks the current runner to rerun only that project's specifications. Build and scheduling errors are recorded and printed by the runner. Closing waits for startup, pending updates and the owned watcher; it does not start or stop another test process.

Vite+ uses the same plugin and `vp test`; import `defineConfig` from `vite-plus` in that host's configuration and keep its Vitest peer aligned with the runner.

The package exports Vitest-compatible `test` and `it` functions with an isolated mini-program runtime fixture, plus Vitest's native `expect`. Other APIs such as `describe`, hooks, and `vi` continue to come directly from Vitest:

```ts
import { expect, test } from '@mpcore/vitest'

test('renders a page', async ({ mpcore }) => {
  const result = await mpcore.renderPage('/pages/index/index')
  expect(result.screen.getByText('ready')).toBeInTheMiniProgram()
})
```

`createMpcoreTest()` remains available when a project needs a separately configured fixture. `createVitestProject()` remains available for tests that manage a project explicitly.

`createMpcoreTest({ artifact: { projectPath: process.cwd() } })` still accepts an existing artifact directly. `createVitestProject()` also uses the configured artifact when omitted, and closes its runtime with the current test. Optional host mocks and `failOnConsoleError` can be passed without replacing the injected artifact. Calling either helper without a configured or explicit artifact reports an actionable error.

Setup also registers the semantic tree snapshot serializer from `@mpcore/test`. Use `expect(result.screen).toMatchSnapshot()` or snapshot an individual node. Snapshots preserve public tree and event-binding semantics while removing runtime IDs, style scope markers and generated handler names. Full diagnostic snapshots returned by `page.snapshot()` remain unchanged; use `toMiniProgramSnapshot()` explicitly to serialize one.

Matcher types can coexist with `@vitest/browser/matchers` in projects sharing a TypeScript program. Mini-program `toHaveTextContent` preserves partial string and regular expression matching, and accepts numeric text, an omitted value to check for nonempty content, and explicit `{ normalizeWhitespace: true }`. DOM assertions continue to use Vitest's browser implementation.

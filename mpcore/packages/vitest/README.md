# @mpcore/vitest

Vitest 5 integration for `@mpcore/test`. Add `mpcoreTest()` to the Vitest plugin list, then use `createMpcoreTest()` for an isolated mini-program project fixture per test.

```ts
import { createMpcoreTest } from '@mpcore/vitest'

const test = createMpcoreTest({
  artifact: { projectPath: process.cwd() },
})

test('renders a page', async ({ mpcore, expect }) => {
  const result = await mpcore.renderPage('/pages/index/index')
  expect(result.screen.getByText('ready')).toBeInTheMiniProgram()
})
```

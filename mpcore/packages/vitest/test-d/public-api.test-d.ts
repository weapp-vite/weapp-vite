import { createMpcoreTest, mpcoreTest } from '@mpcore/vitest'
import { expectType } from 'tsd'

expectType<string>(mpcoreTest().name)

const test = createMpcoreTest({
  artifact: { projectPath: '/project' },
})

test('fixture type', async ({ mpcore }) => {
  expectType<Promise<void>>(mpcore.close())
})

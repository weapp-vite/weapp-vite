import { createCompilerContext } from '@/context'
import { getFixture } from '../utils'

describe.skip('buildNpm', () => {
  it('case 0', async () => {
    const root = getFixture('build-npm')

    const ctx = await createCompilerContext({
      cwd: root,
    })
    await ctx.buildNpm()
    console.log('ctx.buildNpm()')
  })
})

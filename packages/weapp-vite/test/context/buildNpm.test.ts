import { createCompilerContext } from '@/context'
import { getFixture } from '../utils'

describe('buildNpm', () => {
  it('case 0', async () => {
    const root = getFixture('build-npm')

    const ctx = await createCompilerContext({
      cwd: root,
    }, {
      loadConfig: false,
    })
    await ctx.loadDefaultConfig()
    await ctx.buildNpm()
    console.log('ctx.buildNpm()')
  })
})

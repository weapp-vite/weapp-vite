import { CompilerContext } from '@/context'
import { getFixture } from '../utils'

describe('buildNpm', () => {
  it('case 0', async () => {
    const root = getFixture('build-npm')

    const ctx = new CompilerContext({
      cwd: root,
    })
    await ctx.loadDefaultConfig()
    await ctx.buildNpm()
    console.log('ctx.buildNpm()')
  })
})

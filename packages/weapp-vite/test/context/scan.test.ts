import { CompilerContext } from '@/context'
import { getFixture } from '../utils'

describe('scan', () => {
  it('compilerContext ', async () => {
    const ctx = new CompilerContext({
      cwd: getFixture('mixjs'),
    })

    await ctx.loadDefaultConfig()

    await ctx.scanAppEntry()

    console.log(ctx.entries)
    expect(ctx.entries.size).toBe(11)
  })
})

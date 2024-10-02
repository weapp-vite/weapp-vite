import { CompilerContext } from '@/context'
import { getFixture } from '../utils'

describe('scan', () => {
  it('compilerContext ', async () => {
    const ctx = new CompilerContext({
      cwd: getFixture('mixjs'),
    })

    await ctx.loadDefaultConfig()

    await ctx.scanAppEntry()

    expect(ctx.entriesSet.size).toBe(11)
    expect(ctx.entries.length).toBe(11)
    console.log(ctx.entries)
  })
})

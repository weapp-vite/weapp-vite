import { CompilerContext } from '@/context'
import { getApp, getFixture } from '../utils'

describe('scan', () => {
  it('compilerContext ', async () => {
    const ctx = new CompilerContext({
      cwd: getFixture('mixjs'),
    })

    await ctx.loadDefaultConfig()

    await ctx.scanAppEntry()

    expect(ctx.entriesSet.size).toBe(11)
    expect(ctx.entries.length).toBe(11)
    // console.log(ctx.entries)
  })

  it('compilerContext scan vite-native', async () => {
    const ctx = new CompilerContext({
      cwd: getApp('vite-native'),
    })

    await ctx.loadDefaultConfig()

    await ctx.scanAppEntry()

    const packageBEntriesCount = 2
    expect(ctx.entriesSet.size).toBe(6)
    expect(ctx.entries.length).toBe(6)
    expect(ctx.subPackageMeta.packageB).toBeDefined()
    expect(ctx.subPackageMeta.packageB.entries.length).toBe(packageBEntriesCount)
    expect(ctx.subPackageMeta.packageB.entriesSet.size).toBe(packageBEntriesCount)
    // console.log(ctx.entries)
  })
})

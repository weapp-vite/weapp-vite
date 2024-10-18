import { CompilerContext } from '@/context'
import { omit } from 'lodash-es'
import path from 'pathe'
import { getApp, getFixture } from '../utils'
// jsonPath?: string
// sitemapJsonPath?: string
// themeJsonPath?: string
function removePaths(obj?: object) {
  return omit(obj, ['path', 'jsonPath', 'sitemapJsonPath', 'themeJsonPath'])
}

describe('scan', () => {
  it('compilerContext ', async () => {
    const ctx = new CompilerContext({
      cwd: getFixture('mixjs'),
    })

    await ctx.loadDefaultConfig()

    const appEntry = await ctx.scanAppEntry()

    expect(ctx.entriesSet.size).toBe(11)
    expect(ctx.entries.length).toBe(11)
    expect(removePaths(appEntry)).toMatchSnapshot()
    // console.log(ctx.entries)
  })

  it('compilerContext scan vite-native', async () => {
    const cwd = getApp('vite-native')
    process.chdir(cwd)
    const ctx = new CompilerContext({
      cwd,
    })

    await ctx.loadDefaultConfig()

    const appEntry = await ctx.scanAppEntry()

    const packageBEntriesCount = 2
    expect(ctx.entriesSet.size).toBe(9)
    expect(ctx.entries.length).toBe(9)
    expect(Array.from(ctx.entriesSet).map(x => path.relative(cwd, x))).toMatchSnapshot()
    expect(ctx.subPackageMeta.packageB).toBeDefined()
    expect(ctx.subPackageMeta.packageB.entries.length).toBe(packageBEntriesCount)
    expect(ctx.subPackageMeta.packageB.entriesSet.size).toBe(packageBEntriesCount)
    // expect(appEntry).toMatchSnapshot()
    expect(removePaths(appEntry)).toMatchSnapshot()
    // console.log(ctx.entries)
  })
})

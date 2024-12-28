import { createCompilerContext } from '@/createContext'
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
    const ctx = await createCompilerContext({
      cwd: getFixture('mixjs'),
    })

    const appEntry = await ctx.scanService.scanAppEntry()

    expect(ctx.scanService.entriesSet.size).toBe(11)
    expect(ctx.scanService.entries.length).toBe(11)
    expect(removePaths(appEntry)).toMatchSnapshot()
    // console.log(ctx.entries)
  })

  it.skip('compilerContext scan vite-native', async () => {
    const cwd = getApp('vite-native')
    process.chdir(cwd)
    const ctx = await createCompilerContext({
      cwd,
    })

    const appEntry = await ctx.scanService.scanAppEntry()

    const packageBEntriesCount = 2
    expect(ctx.scanService.entriesSet.size).toBe(9)
    expect(ctx.scanService.entries.length).toBe(9)
    expect(Array.from(ctx.scanService.entriesSet).map(x => path.relative(cwd, x))).toMatchSnapshot()
    expect(ctx.subPackageService.metaMap.packageB).toBeDefined()
    expect(ctx.subPackageService.metaMap.packageB.entries.length).toBe(packageBEntriesCount)
    expect(ctx.subPackageService.metaMap.packageB.entriesSet.size).toBe(packageBEntriesCount)
    // expect(appEntry).toMatchSnapshot()
    expect(removePaths(appEntry)).toMatchSnapshot()
    // console.log(ctx.entries)
  })
})

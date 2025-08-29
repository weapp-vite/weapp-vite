import { omit } from 'lodash-es'
import { createCompilerContext } from '@/createContext'
import { getFixture } from '../utils'
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
    const appEntry = await ctx.scanService.loadAppEntry()
    expect(removePaths(appEntry)).toMatchSnapshot()
  })

  it('loadAppEntry ', async () => {
    const ctx = await createCompilerContext({
      cwd: getFixture('subPackages'),
    })
    const appEntry = await ctx.scanService.loadAppEntry()
    const entries = await ctx.scanService.loadSubPackages()
    expect(removePaths(appEntry)).toMatchSnapshot()
    expect(entries).toMatchSnapshot()
  })
})

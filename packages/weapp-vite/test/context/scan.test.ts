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

  it('loadSubPackages collects plugin export entries', async () => {
    const ctx = await createCompilerContext({
      cwd: getFixture('subPackages'),
    })
    const appEntry = await ctx.scanService.loadAppEntry()
    const subPackages = [
      ...(appEntry.json.subPackages ?? []),
      ...(appEntry.json.subpackages ?? []),
    ] as any[]

    if (!subPackages.length) {
      throw new Error('expected subPackages in fixture')
    }

    subPackages[0].plugins = {
      myPlugin: {
        export: 'exportToPlugin.js',
      },
    }

    if (subPackages[1]) {
      subPackages[1].plugins = {
        anotherPlugin: {
          export: 'independentExport.js',
        },
      }
    }

    const metas = ctx.scanService.loadSubPackages()
    const packageAMeta = metas.find(meta => meta.subPackage.root === 'packageA')
    expect(packageAMeta?.entries).toContain('packageA/exportToPlugin')

    const packageBMeta = metas.find(meta => meta.subPackage.root === 'packageB')
    expect(packageBMeta?.entries).toContain('packageB/independentExport')
  })
})

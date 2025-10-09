import type { CompilerContext } from '../../src/context'
import { omit } from 'lodash-es'
import { createTestCompilerContext, getFixture } from '../utils'
// jsonPath?: string
// sitemapJsonPath?: string
// themeJsonPath?: string
function removePaths(obj?: object) {
  return omit(obj, ['path', 'jsonPath', 'sitemapJsonPath', 'themeJsonPath'])
}

describe('scan', () => {
  let mixjsCtx: CompilerContext
  let disposeMixjs: (() => Promise<void>) | undefined
  let subPackagesCtx: CompilerContext
  let disposeSubPackages: (() => Promise<void>) | undefined

  beforeAll(async () => {
    const mixResult = await createTestCompilerContext({
      cwd: getFixture('mixjs'),
    })
    mixjsCtx = mixResult.ctx
    disposeMixjs = mixResult.dispose

    const subPackagesResult = await createTestCompilerContext({
      cwd: getFixture('subPackages'),
    })
    subPackagesCtx = subPackagesResult.ctx
    disposeSubPackages = subPackagesResult.dispose
  })

  afterAll(async () => {
    await disposeMixjs?.()
    await disposeSubPackages?.()
  })

  it('compilerContext ', async () => {
    mixjsCtx.scanService.markDirty()
    const appEntry = await mixjsCtx.scanService.loadAppEntry()
    expect(removePaths(appEntry)).toMatchSnapshot()
  })

  it('loadAppEntry ', async () => {
    subPackagesCtx.scanService.markDirty()
    const appEntry = await subPackagesCtx.scanService.loadAppEntry()
    const entries = await subPackagesCtx.scanService.loadSubPackages()
    expect(removePaths(appEntry)).toMatchSnapshot()
    expect(entries).toMatchSnapshot()
  })

  it('loadSubPackages collects plugin export entries', async () => {
    subPackagesCtx.scanService.markDirty()
    const appEntry = await subPackagesCtx.scanService.loadAppEntry()
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

    const metas = subPackagesCtx.scanService.loadSubPackages()
    const packageAMeta = metas.find(meta => meta.subPackage.root === 'packageA')
    expect(packageAMeta?.entries).toContain('packageA/exportToPlugin')

    const packageBMeta = metas.find(meta => meta.subPackage.root === 'packageB')
    expect(packageBMeta?.entries).toContain('packageB/independentExport')

    subPackagesCtx.scanService.markDirty()
  })
})

import CI from 'ci-info'
import { omit } from 'es-toolkit'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createCompilerContext } from 'weapp-vite'

function removePaths(obj: Record<string, any>) {
  return omit(obj, ['path', 'jsonPath', 'sitemapJsonPath', 'themeJsonPath'])
}

describe.skipIf(CI.isCI)('scan', () => {
  it('compilerContext scan vite-native', async () => {
    const { buildService, scanService, subPackageService, configService, wxmlService } = await createCompilerContext({
      cwd: path.resolve(import.meta.dirname, '..'),
    })

    await buildService.build()

    const packageBEntriesCount = 2
    expect(scanService.entriesSet.size).toMatchSnapshot('entriesSet')
    expect(scanService.entries.length).toMatchSnapshot('entries')
    expect(Array.from(scanService.entriesSet).map(x => path.relative(configService.cwd, x))).toMatchSnapshot()
    expect(subPackageService.metaMap.packageB).toBeDefined()
    expect(subPackageService.metaMap.packageB.entries.length).toBe(packageBEntriesCount)
    expect(subPackageService.metaMap.packageB.entriesSet.size).toBe(packageBEntriesCount)
    // expect(appEntry).toMatchSnapshot()
    if (scanService.appEntry) {
      expect(removePaths(scanService.appEntry)).toMatchSnapshot()
    }
    expect(scanService.pagesSet).toMatchSnapshot('getPagesSet')
    // expect(ctx.potentialComponentMap).toMatchSnapshot('potentialComponentMap')
    //  expect(ctx.wxmlComponentsMap).toMatchSnapshot('wxmlComponentsMap')

    // console.log(ctx.entries)
  })
})

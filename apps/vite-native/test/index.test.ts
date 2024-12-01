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
    const ctx = await createCompilerContext({
      cwd: path.resolve(import.meta.dirname, '..'),
    })

    await ctx.build()

    const packageBEntriesCount = 2
    expect(ctx.entriesSet.size).toMatchSnapshot('entriesSet')
    expect(ctx.entries.length).toMatchSnapshot('entries')
    expect(Array.from(ctx.entriesSet).map(x => path.relative(ctx.cwd, x))).toMatchSnapshot()
    expect(ctx.subPackageMeta.packageB).toBeDefined()
    expect(ctx.subPackageMeta.packageB.entries.length).toBe(packageBEntriesCount)
    expect(ctx.subPackageMeta.packageB.entriesSet.size).toBe(packageBEntriesCount)
    // expect(appEntry).toMatchSnapshot()
    if (ctx.appEntry) {
      expect(removePaths(ctx.appEntry)).toMatchSnapshot()
    }
    expect(ctx.getPagesSet()).toMatchSnapshot('getPagesSet')
    // expect(ctx.potentialComponentMap).toMatchSnapshot('potentialComponentMap')
    //  expect(ctx.wxmlComponentsMap).toMatchSnapshot('wxmlComponentsMap')

    // console.log(ctx.entries)
  })
})

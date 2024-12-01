import { omit } from 'es-toolkit'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createCompilerContext } from 'weapp-vite'

function removePaths(obj: Record<string, any>) {
  return omit(obj, ['path', 'jsonPath', 'sitemapJsonPath', 'themeJsonPath'])
}

describe('scan', () => {
  it('compilerContext scan vite-native', async () => {
    const ctx = await createCompilerContext({
      cwd: path.resolve(import.meta.dirname, '..'),
    })

    const appEntry = await ctx.scanAppEntry()

    const packageBEntriesCount = 2
    expect(ctx.entriesSet.size).toMatchSnapshot()
    expect(ctx.entries.length).toMatchSnapshot()
    expect(Array.from(ctx.entriesSet).map(x => path.relative(ctx.cwd, x))).toMatchSnapshot()
    expect(ctx.subPackageMeta.packageB).toBeDefined()
    expect(ctx.subPackageMeta.packageB.entries.length).toBe(packageBEntriesCount)
    expect(ctx.subPackageMeta.packageB.entriesSet.size).toBe(packageBEntriesCount)
    // expect(appEntry).toMatchSnapshot()
    if (appEntry) {
      expect(removePaths(appEntry)).toMatchSnapshot()
    }

    // console.log(ctx.entries)
  })
})

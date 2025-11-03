import type { CompilerContext } from '@/context'
import { describe, expect, it } from 'vitest'
import { analyzeSubpackages } from '@/analyze/subpackages'
import { createCompilerContext } from '@/createContext'
import { getFixture } from './utils'

describe('analyzeSubpackages', () => {
  const cwd = getFixture('subpackage-dayjs')

  async function withContext<T>(fn: (ctx: CompilerContext) => Promise<T>) {
    const ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
        weapp: {
          chunks: {
            sharedStrategy: 'duplicate',
          },
        },
      },
    })

    try {
      return await fn(ctx)
    }
    finally {
      await ctx.watcherService?.closeAll()
    }
  }

  it('summarizes chunk and module distribution across packages', async () => {
    await withContext(async (ctx) => {
      const result = await analyzeSubpackages(ctx)
      const packageIds = result.packages.map(pkg => pkg.id)
      expect(packageIds).toContain('__main__')
      expect(packageIds).toContain('packageA')
      expect(packageIds).toContain('packageB')
      expect(packageIds).toContain('virtual:packageA_packageB')

      const packageA = result.packages.find(pkg => pkg.id === 'packageA')
      expect(packageA?.files.some(file => file.file === 'packageA/weapp-shared/common.js')).toBe(true)
      expect(packageA?.files.some(file => file.file === 'packageA/pages/foo.js')).toBe(true)

      const sharedModule = result.modules.find(module => module.source.endsWith('shared/utils.ts'))
      expect(sharedModule).toBeDefined()
      expect(sharedModule?.packages.map(ref => ref.packageId).sort()).toEqual([
        'packageA',
        'packageB',
        'virtual:packageA_packageB',
      ])
    })
  })
})

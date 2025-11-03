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
      expect(packageIds.some(id => id.startsWith('virtual:'))).toBe(false)

      const packageA = result.packages.find(pkg => pkg.id === 'packageA')
      expect(packageA?.files.some(file => file.file === 'packageA/weapp-shared/common.js')).toBe(true)
      expect(packageA?.files.some(file => file.file === 'packageA/pages/foo.js')).toBe(true)

      const fooModule = result.modules.find(module => module.source.endsWith('pages/foo.ts'))
      expect(fooModule?.packages.map(ref => ref.packageId)).toEqual(['packageA'])

      const barModule = result.modules.find(module => module.source.endsWith('pages/bar.ts'))
      expect(barModule?.packages.map(ref => ref.packageId)).toEqual(['packageB'])
    })
  })
})

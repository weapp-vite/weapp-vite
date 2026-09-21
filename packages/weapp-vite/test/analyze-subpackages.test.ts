import type { CompilerContext } from '@/context'
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { analyzeSubpackages } from '@/analyze/subpackages'
import { createCompilerContext } from '@/createContext'
import { getFixture } from './utils'

describe('analyzeSubpackages', () => {
  const cwd = getFixture('subpackage-dayjs')
  const outDir = path.join(cwd, '.tmp', 'analyze-artifacts')

  async function withContext<T>(fn: (ctx: CompilerContext) => Promise<T>) {
    await rm(outDir, { recursive: true, force: true })
    const ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
          outDir,
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
      await rm(outDir, { recursive: true, force: true })
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

  it('captures the exact analyzed outputs without writing bundle files', async () => {
    await withContext(async (ctx) => {
      const captured = new Map<string, Buffer>()
      const result = await analyzeSubpackages(ctx, {
        onArtifact(fileName, source) {
          captured.set(fileName, Buffer.from(source))
        },
      })
      const reported = new Map(result.packages.flatMap(pkg => (
        pkg.files.map(file => [file.file, file] as const)
      )))

      expect([...captured.keys()].sort()).toEqual([...reported.keys()].sort())
      expect([...reported.values()].some(file => file.type === 'asset')).toBe(true)

      for (const [fileName, content] of captured) {
        const file = reported.get(fileName)
        expect(file, fileName).toBeDefined()
        expect(content.byteLength, fileName).toBe(file?.size)
        expect(gzipSync(content).byteLength, fileName).toBe(file?.gzipSize)
        expect(brotliCompressSync(content).byteLength, fileName).toBe(file?.brotliSize)
        expect(existsSync(path.join(ctx.configService.outDir, fileName)), fileName).toBe(false)
      }
    })
  })
})

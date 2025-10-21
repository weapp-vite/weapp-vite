import type { CompilerContext } from '@/context'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture, scanFiles } from './utils'

describe('subpackage dayjs fixture', () => {
  const cwd = getFixture('subpackage-dayjs')

  let ctx: CompilerContext | undefined

  async function buildWithStrategy(strategy: 'duplicate' | 'hoist') {
    const outDir = strategy === 'duplicate' ? 'dist-duplicate' : 'dist-hoist'
    const resolvedOutDir = path.resolve(cwd, outDir)
    await fs.remove(resolvedOutDir)
    const inlineConfig = {
      build: {
        minify: false,
        outDir,
      },
      weapp: {
        chunks: {
          sharedStrategy: strategy,
        },
      },
    }

    ctx = await createCompilerContext({
      cwd,
      inlineConfig,
    })

    await ctx.buildService.build()
    return resolvedOutDir
  }

  afterEach(async () => {
    if (ctx?.watcherService) {
      await ctx.watcherService.closeAll()
    }
    ctx = undefined
  })

  it('duplicates shared utilities and dayjs in duplicate mode', async () => {
    const duplicateOutDir = await buildWithStrategy('duplicate')
    const files = await scanFiles(duplicateOutDir)

    expect(files).toContain('packageA/__shared__/common.js')
    expect(files).toContain('packageB/__shared__/common.js')
    expect(files).not.toContain('common.js')
    expect(files).not.toContain('vendors.js')

    const duplicated = await fs.readFile(path.resolve(duplicateOutDir, 'packageA/__shared__/common.js'), 'utf8')
    expect(duplicated).toMatch(/shared:/)
    expect(duplicated).toMatch(/DAY_MS/)
  })

  it('hoists shared utilities and vendors when strategy is hoist', async () => {
    const hoistOutDir = await buildWithStrategy('hoist')
    const files = await scanFiles(hoistOutDir)

    expect(files).toContain('common.js')
    expect(files).not.toContain('packageA/__shared__/common.js')
    expect(files).not.toContain('packageB/__shared__/common.js')

    const commonCode = await fs.readFile(path.resolve(hoistOutDir, 'common.js'), 'utf8')
    expect(commonCode).toMatch(/shared:/)
    expect(commonCode).toMatch(/DAY_MS/)
  })
})

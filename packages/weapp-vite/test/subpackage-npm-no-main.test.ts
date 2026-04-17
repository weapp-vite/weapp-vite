import type { CompilerContext } from '@/context'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture, scanFiles } from './utils'

describe('subpackage npm without main output', () => {
  const cwd = getFixture('subpackage-npm-no-main')

  let ctx: CompilerContext | undefined

  afterEach(async () => {
    if (ctx?.watcherService) {
      await ctx.watcherService.closeAll()
    }
    ctx = undefined
  })

  it('keeps miniprogram_npm only inside independent subpackages', async () => {
    const outDir = path.resolve(cwd, 'dist')
    await fs.remove(outDir)
    await fs.outputFile(path.resolve(outDir, 'miniprogram_npm/stale/index.js'), 'module.exports = "stale"')

    ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })

    await ctx.buildService.build()

    const files = await scanFiles(outDir)

    expect(files.some(file => file.startsWith('miniprogram_npm/'))).toBe(false)
    expect(await fs.pathExists(path.resolve(outDir, 'miniprogram_npm'))).toBe(false)

    expect(files).toContain('packageA/miniprogram_npm/clsx/index.js')
    expect(files).toContain('packageA/miniprogram_npm/dayjs/index.js')
    expect(files).not.toContain('packageA/miniprogram_npm/class-variance-authority/index.js')

    expect(files).toContain('packageB/miniprogram_npm/class-variance-authority/index.js')
    expect(files).toContain('packageB/miniprogram_npm/dayjs/index.js')
    expect(files).toContain('packageB/miniprogram_npm/clsx/index.js')
  })
})

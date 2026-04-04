import type { CompilerContext } from '@/context'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture } from './utils'

describe('subpackage npm local outputs', () => {
  const cwd = getFixture('subpackage-npm-normal')

  let ctx: CompilerContext | undefined

  afterEach(async () => {
    if (ctx?.watcherService) {
      await ctx.watcherService.closeAll()
    }
    ctx = undefined
  })

  it('emits local npm outputs and rewrites runtime paths for normal subpackages', async () => {
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

    expect(await fs.pathExists(path.resolve(outDir, 'miniprogram_npm'))).toBe(false)

    expect(await fs.pathExists(path.resolve(outDir, 'packageA/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outDir, 'packageA/miniprogram_npm/tdesign-miniprogram/button/button.json'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outDir, 'packageA/miniprogram_npm/clsx/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outDir, 'packageA/miniprogram_npm/class-variance-authority/index.js'))).toBe(false)

    expect(await fs.pathExists(path.resolve(outDir, 'packageB/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outDir, 'packageB/miniprogram_npm/tdesign-miniprogram/button/button.json'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outDir, 'packageB/miniprogram_npm/class-variance-authority/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outDir, 'packageB/miniprogram_npm/clsx/index.js'))).toBe(false)

    const packageAFooJs = await fs.readFile(path.resolve(outDir, 'packageA/pages/foo.js'), 'utf8')
    expect(packageAFooJs).toContain('require("../miniprogram_npm/dayjs/index")')
    expect(packageAFooJs).not.toContain('require("dayjs")')

    const packageBBarJs = await fs.readFile(path.resolve(outDir, 'packageB/pages/bar.js'), 'utf8')
    expect(packageBBarJs).toContain('require("../miniprogram_npm/dayjs/index")')
    expect(packageBBarJs).toContain('require("../miniprogram_npm/class-variance-authority/index")')

    const packageAFooJson = await fs.readFile(path.resolve(outDir, 'packageA/pages/foo.json'), 'utf8')
    expect(packageAFooJson).toContain('"t-button": "../miniprogram_npm/tdesign-miniprogram/button/button"')

    const packageBBarJson = await fs.readFile(path.resolve(outDir, 'packageB/pages/bar.json'), 'utf8')
    expect(packageBBarJson).toContain('"t-button": "../miniprogram_npm/tdesign-miniprogram/button/button"')
  })
})

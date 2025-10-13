import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI).sequential('subPackages', () => {
  const cwd = getFixture('subPackages')
  const distDir = path.resolve(cwd, 'dist')
  // beforeAll(async () => {
  //   await fs.remove(distDir)
  //   const ctx = await createCompilerContext({
  //     cwd,
  //   })
  //   await ctx.buildService.runProd()
  //   expect(await fs.exists(distDir)).toBe(true)
  // })

  it('scanFiles', async () => {
    await fs.remove(distDir)
    await process.nextTick(() => {})
    const ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })
    await ctx.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    expect(wxsCodeCache.size).toBe(0)
    expect(cssCodeCache.size).toBeGreaterThanOrEqual(1)

    expect(ctx.scanService.independentSubPackageMap).toMatchSnapshot()
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/buffer'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/gm-crypto'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/pages/banana.js'))).toBe(true)
    expect(await fs.readFile(path.resolve(distDir, 'packageB/pages/banana.js'), 'utf8')).toMatchSnapshot()
  })
})

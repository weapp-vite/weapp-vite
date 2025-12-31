import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { createTestCompilerContext, getFixture, scanFiles } from './utils'

async function waitForPathExists(
  targetPath: string,
  options: {
    timeoutMs?: number
    intervalMs?: number
  } = {},
) {
  const timeoutMs = options.timeoutMs ?? 5000
  const intervalMs = options.intervalMs ?? 50
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(targetPath)) {
      return
    }
    await new Promise<void>(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timed out waiting for path to exist: ${targetPath}`)
}

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

  beforeEach(() => {
    wxsCodeCache.clear()
    cssCodeCache.clear()
  })

  it('scanFiles', async () => {
    await fs.remove(distDir)
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })

    try {
      await ctx.buildService.build()

      expect(await fs.exists(distDir)).toBe(true)
      await waitForPathExists(path.resolve(distDir, 'packageB/pages/banana.wxml'))

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
      expect(await fs.exists(path.resolve(distDir, 'packageB/pages/banana.wxml'))).toBe(true)
      expect(await fs.readFile(path.resolve(distDir, 'packageB/pages/banana.js'), 'utf8')).toMatchSnapshot()
    }
    finally {
      await dispose()
    }
  })
})

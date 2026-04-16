import { fs } from '@weapp-core/shared/fs'
import CI from 'ci-info'
import path from 'pathe'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { createTestCompilerContext, getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('subPackages-dependencies', () => {
  const cwd = getFixture('subPackages-dependencies')
  const distDir = path.resolve(cwd, 'dist')
  const nodeModulesDir = path.resolve(cwd, 'node_modules')

  beforeEach(async () => {
    await fs.remove(distDir)
    await fs.remove(nodeModulesDir)
  })

  afterEach(async () => {
    await fs.remove(distDir)
  })

  it('scanFiles', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
    })
    try {
      await ctx.buildService.build()
      expect(await fs.exists(distDir)).toBe(true)
      const files = await scanFiles(distDir)
      expect(files).toMatchSnapshot()
      expect(wxsCodeCache.size).toBe(0)
      expect(cssCodeCache.size).toBe(4)
      const appJson = await fs.readJson(path.resolve(distDir, 'app.json'))
      const packageB = [...appJson.subPackages ?? [], ...appJson.subpackages ?? []].find((item: { root?: string }) => item.root === 'packageB')

      expect(ctx.scanService.independentSubPackageMap).toMatchSnapshot()
      expect(packageB).toBeDefined()
      expect(packageB).not.toHaveProperty('dependencies')
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/class-variance-authority'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/buffer'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/gm-crypto'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/class-variance-authority'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/clsx'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/dayjs'))).toBe(false)
    }
    finally {
      await dispose()
    }
  })
})

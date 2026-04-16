import { fs } from '@weapp-core/shared/fs'
import CI from 'ci-info'
import path from 'pathe'
import picomatch from 'picomatch'
import { createCompilerContext } from '@/createContext'
import { defaultAssetExtensions } from '@/defaults'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('asset', () => {
  const cwd = getFixture('asset')
  const distDir = path.resolve(cwd, 'dist')
  it('scanFiles', async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    expect(wxsCodeCache.size).toBe(0)
    expect(cssCodeCache.size).toBeGreaterThanOrEqual(1)

    expect(ctx.scanService.independentSubPackageMap).toMatchSnapshot()
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(false)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(false)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(false)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm'))).toBe(false)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/buffer'))).toBe(false)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/gm-crypto'))).toBe(false)
    const copyConfig = ctx.configService.weappViteConfig?.copy
    const excludePatterns = copyConfig?.exclude
    const excludeMatchers = (Array.isArray(excludePatterns) ? excludePatterns : excludePatterns ? [excludePatterns] : [])
      .map(pattern => picomatch(pattern, { dot: true }))

    for (const ext of defaultAssetExtensions) {
      const distAssetPath = path.resolve(distDir, `assets/index.${ext}`)
      const srcAssetPath = path.resolve(ctx.configService.absoluteSrcRoot, `assets/index.${ext}`)
      const sourceExists = await fs.exists(srcAssetPath)
      const distExists = await fs.exists(distAssetPath)
      if (!sourceExists) {
        expect(distExists).toBe(false)
        continue
      }

      const isExcluded = excludeMatchers.some(match => match(srcAssetPath) || match(`assets/index.${ext}`))
      expect(distExists).toBe(!isExcluded)
    }
  })
})

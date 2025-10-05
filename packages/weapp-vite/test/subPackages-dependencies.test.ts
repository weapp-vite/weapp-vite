import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('subPackages-dependencies', () => {
  const cwd = getFixture('subPackages-dependencies')
  const distDir = path.resolve(cwd, 'dist')

  it('scanFiles', async () => {
    await fs.remove(distDir)
    await fs.remove(path.resolve(cwd, 'node_modules'))
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    expect(wxsCodeCache.size).toBe(0)
    expect(cssCodeCache.size).toBe(4)

    expect(ctx.scanService.independentSubPackageMap).toMatchSnapshot()
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/buffer'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/gm-crypto'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/clsx'))).toBe(false)
    expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/dayjs'))).toBe(false)
  })
})

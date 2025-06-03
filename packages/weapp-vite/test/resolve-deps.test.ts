import type { CompilerContext } from '@/context'
import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('resolve-deps', () => {
  const cwd = getFixture('resolve-deps')
  const distDir = path.resolve(cwd, 'dist')
  let ctx: CompilerContext
  beforeAll(async () => {
    await fs.remove(distDir)
    ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
  })

  it('scanFiles', async () => {
    const files = await scanFiles(distDir)
    // expect(files).toMatchSnapshot()
    const codes = await Promise.all(
      files.filter(x => x.endsWith('.json')).map((x) => {
        return fs.readFile(path.resolve(distDir, x), 'utf-8')
      }),
    )
    expect(codes).toMatchSnapshot()
    expect(wxsCodeCache.size).toBe(0)
    expect(cssCodeCache.size).toBe(11)
    expect(ctx.scanService.subPackageMap).toMatchSnapshot()
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
    // expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
    // expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)
  })
})

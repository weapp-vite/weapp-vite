import { createCompilerContext } from '@/createContext'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('subPackages', () => {
  const cwd = getFixture('subPackages')
  const distDir = path.resolve(cwd, 'dist')
  beforeAll(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.runProd()
    expect(await fs.exists(distDir)).toBe(true)
  })

  it('scanFiles', async () => {
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    expect(wxsCodeCache.size).toBe(0)
    expect(cssCodeCache.size).toBe(4)
  })
})

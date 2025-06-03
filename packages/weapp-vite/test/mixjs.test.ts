// import logger from '@/logger'
import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { getFixture, scanFiles } from './utils'

vi.mock('@/logger', () => ({
  // ...await importOriginal<typeof import('@/logger')>(),
  default: {
    warn: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
  // warn: vi.fn(),
}))

describe.skipIf(CI.isCI)('build', () => {
  const cwd = getFixture('mixjs')
  const distDir = path.resolve(cwd, 'dist')
  beforeEach(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()

    expect(await fs.exists(distDir)).toBe(true)
  })

  it('abs import src', async () => {
    expect(await fs.exists(path.resolve(distDir, 'import/a.wxml'))).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
  })
})

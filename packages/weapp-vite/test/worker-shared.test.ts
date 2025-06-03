import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
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

describe.skipIf(CI.isCI)('worker-shared', () => {
  const cwd = getFixture('worker-shared')
  const distDir = path.resolve(cwd, 'dist')
  beforeEach(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })
    await ctx.buildService.build()
  })

  it('dist', async () => {
    expect(await fs.exists(path.resolve(distDir))).toBe(true)

    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    for (const file of files) {
      const content = await fs.readFile(path.resolve(distDir, file), 'utf-8')
      expect(content).toMatchSnapshot(file)
    }
    expect(logger.success).toHaveBeenCalled()
  })
})

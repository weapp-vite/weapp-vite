import crypto from 'node:crypto'
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
    error: vi.fn(),
  },
  // warn: vi.fn(),
}))

describe.skipIf(CI.isCI)('tabbar-appbar', () => {
  const cwd = getFixture('tabbar-appbar')
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
      if (file === 'vue.js') {
        continue
      }
      const content = await fs.readFile(path.resolve(distDir, file), 'utf-8')
      // common/runtime bundles are large and change frequently; snapshot only a stable summary.
      if (file === 'common.js' || file === 'rolldown-runtime.js') {
        expect({
          size: content.length,
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
          head: content.split('\n').slice(0, 5).join('\n'),
        }).toMatchSnapshot(file)
        continue
      }
      expect(content).toMatchSnapshot(file)
    }
    expect(logger.success).toHaveBeenCalled()
  })
})

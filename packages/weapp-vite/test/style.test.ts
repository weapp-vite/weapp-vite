import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { getFixture, normalizeFixtureRegionPaths, scanFiles } from './utils'

vi.mock('@/logger', () => ({
  // ...await importOriginal<typeof import('@/logger')>(),
  default: {
    warn: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  configureLogger: vi.fn(),
  // warn: vi.fn(),
}))

const SOURCE_STYLE_RE = /\.(?:scss|sass|less|styl|pcss|postcss)$/

describe('build style', {
  timeout: 100000000,
}, () => {
  const cwd = getFixture('style')
  const distDir = path.resolve(cwd, 'dist')
  beforeEach(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
    expect(logger.warn).toHaveBeenCalledWith('没有找到 `pages/index/vue` 的入口文件，请检查路径是否正确!')
    expect(await fs.exists(distDir)).toBe(true)
  }, 100000000)

  it('dist', async () => {
    expect(await fs.exists(path.resolve(distDir))).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    expect(files.filter(file => SOURCE_STYLE_RE.test(file))).toEqual([])
    expect(files).toContain('pages/index/index.wxss')
    for (const file of files) {
      const content = await fs.readFile(path.resolve(distDir, file), 'utf-8')
      expect(normalizeFixtureRegionPaths(content)).toMatchSnapshot(file)
    }
  })

  it('compiles raw scss through Sass and PostCSS into wxss', async () => {
    const files = await scanFiles(distDir)
    expect(files.filter(file => SOURCE_STYLE_RE.test(file))).toEqual([])

    const pageWxss = await fs.readFile(path.resolve(distDir, 'pages/index/index.wxss'), 'utf-8')
    expect(pageWxss).toContain('.page .title')
    expect(pageWxss).toContain('-webkit-background-clip: text;')
    expect(pageWxss).not.toContain('$brand')
    expect(pageWxss).not.toContain('// https://example.com')
    expect(pageWxss).not.toContain('.page {\n  .title')
  })
})

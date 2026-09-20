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
      if (file.endsWith('.wxss')) {
        continue
      }
      const content = await fs.readFile(path.resolve(distDir, file), 'utf-8')
      expect(normalizeFixtureRegionPaths(content)).toMatchSnapshot(file)
    }
  })

  it('compiles raw scss through Sass and PostCSS into wxss', async () => {
    const files = await scanFiles(distDir)
    expect(files.filter(file => SOURCE_STYLE_RE.test(file))).toEqual([])

    const pageWxss = await fs.readFile(path.resolve(distDir, 'pages/index/index.wxss'), 'utf-8')
    expect(pageWxss).toContain('.page .title')
    expect(pageWxss).toContain('.shared-css {')
    expect(pageWxss).toContain('color: beige;')
    expect(pageWxss).toContain('-webkit-background-clip: text;')
    expect(pageWxss).not.toContain('$brand')
    expect(pageWxss).not.toContain('// https://example.com')
    expect(pageWxss).not.toContain('.page {\n  .title')

    const assetMatch = pageWxss.match(/background-image:\s*url\(([^)]+)\)/)
    expect(assetMatch?.[1]).toBeTruthy()
    const assetUrl = assetMatch![1]!.replace(/^['"]|['"]$/g, '')
    expect(assetUrl).not.toContain('__VITE_ASSET__')
    // Vite 定稿后的根路径相对于小程序产物根，而不是操作系统根目录。
    const assetPath = assetUrl.startsWith('/')
      ? path.resolve(distDir, assetUrl.slice(1))
      : path.resolve(distDir, 'pages/index', assetUrl)
    expect(await fs.readFile(assetPath, 'utf8')).toBe(
      await fs.readFile(path.resolve(cwd, 'src/pages/index/background.svg'), 'utf8'),
    )
    const navbarWxss = await fs.readFile(path.resolve(distDir, 'components/Navbar/Navbar.wxss'), 'utf-8')
    const appWxss = await fs.readFile(path.resolve(distDir, 'app.wxss'), 'utf-8')
    expect(appWxss).toContain('.shared-scss {')
    expect(appWxss).toContain('color: honeydew;')
    expect(appWxss).toContain('.app {')
    expect(appWxss).toContain('color: red;')
    // 同名 SCSS、CSS、WXSS 都属于组件入口，合并后不能泄漏到页面或应用样式。
    for (const [extension, selector] of [['scss', '.navbar {'], ['css', '.navbar-css {'], ['wxss', '.navbar-wxss {']]) {
      const source = await fs.readFile(path.resolve(cwd, `src/components/Navbar/Navbar.${extension}`), 'utf-8')
      expect(source).toContain(selector)
      expect(navbarWxss.split(selector)).toHaveLength(2)
      expect(pageWxss).not.toContain(selector)
      expect(appWxss).not.toContain(selector)
    }
  })
})

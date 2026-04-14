import { readFile, rm, stat } from 'node:fs/promises'
import CI from 'ci-info'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { getFixture, scanFiles } from './utils'

const jsExpectations: Record<string, Array<RegExp | string>> = {
  'app.js': [/require\(["']\.\/rolldown-runtime\.js["']\)/, /\bApp\(/],
  'app-bar/index.js': [
    /require\(["']\.\.\/rolldown-runtime\.js["']\)/,
    /\bComponent\(/,
  ],
  'async2.js': [
    /require\(["']\.\/rolldown-runtime\.js["']\)/,
    /exports\.async2/,
    /exports\.default/,
  ],
  'components/Navbar/Navbar.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /\bComponent\(/,
    /require\.async\(["']\.\.\/\.\.\/pages\/index\/async\.js["']\)/,
  ],
  'components/Test/index.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /\bComponent\(/,
  ],
  'custom-tab-bar/index.js': [
    /require\(["']\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/weapp-vendors\/wevu-defineProperty\.js["']\)/,
    /\bComponent\(/,
    /require\.async\(["']\.\.\/pages\/index\/async\.js["']\)/,
  ],
  'pages/index/async.js': [/exports\.async/, /exports\.default/],
  'pages/index/index.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/\.\.\/weapp-vendors\/wevu-defineProperty\.js["']\)/,
    /\bPage\(/,
    /require\.async\(["']\.\/async["']\)/,
  ],
  'pages/index/vue.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/\.\.\/weapp-vendors\/wevu-src\.js["']\)\.\w+\(\{/,
  ],
  'pages/index/vue-setup.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/\.\.\/weapp-vendors\/wevu-src\.js["']\)\.\w+\(\{/,
  ],
  'weapp-vendors/wevu-defineProperty.js': [
    /__commonJS(?:Min)?/,
    /module\.exports/,
  ],
  'weapp-vendors/wevu-src.js': [
    /require\(["']\.\/wevu-defineProperty\.js["']\)/,
    /\bcreateWevuComponent\b/,
  ],
  'rolldown-runtime.js': [/Object\.defineProperty/],
}

function normalizeDistFile(file: string) {
  return file
}

function assertJsContent(file: string, content: string) {
  const patterns = jsExpectations[normalizeDistFile(file)]
  expect(patterns, `Missing JS expectations for ${file}`).toBeDefined()
  if (!patterns) {
    return
  }
  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      expect(content).toContain(pattern)
      continue
    }
    expect(content).toMatch(pattern)
  }
}

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

describe.skipIf(CI.isCI)('tabbar-appbar', () => {
  const cwd = getFixture('tabbar-appbar')
  const distDir = path.resolve(cwd, 'dist')
  beforeEach(async () => {
    await rm(distDir, { recursive: true, force: true })
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
    expect(await stat(path.resolve(distDir)).then(() => true, () => false)).toBe(true)

    const files = await scanFiles(distDir)
    expect(files.map(normalizeDistFile)).toMatchSnapshot()
    for (const file of files) {
      const content = await readFile(path.resolve(distDir, file), 'utf-8')
      if (path.extname(file) === '.js') {
        assertJsContent(file, content)
        continue
      }
      expect(content).toMatchSnapshot(file)
    }
    expect(logger.success).toHaveBeenCalled()
  })
})

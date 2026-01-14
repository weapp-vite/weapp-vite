import CI from 'ci-info'
import fs from 'fs-extra'
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
  'common.js': [/__commonJS/, /module\.exports/],
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
    /require\(["']\.\.\/common\.js["']\)/,
    /\bComponent\(/,
    /require\.async\(["']\.\.\/pages\/index\/async\.js["']\)/,
  ],
  'pages/index/async.js': [/exports\.async/, /exports\.default/],
  'pages/index/index.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/\.\.\/common\.js["']\)/,
    /\bPage\(/,
    /require\.async\(["']\.\/async["']\)/,
  ],
  'pages/index/vue.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/\.\.\/common\.js["']\)/,
    /require_common\.\w+\(\{\}\)/,
  ],
  'pages/index/vue-setup.js': [
    /require\(["']\.\.\/\.\.\/rolldown-runtime\.js["']\)/,
    /require\(["']\.\.\/\.\.\/common\.js["']\)/,
    /require_common\.\w+\(\{\}\)/,
  ],
  'rolldown-runtime.js': [/Object\.defineProperty/],
}

function assertJsContent(file: string, content: string) {
  const patterns = jsExpectations[file]
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
      const content = await fs.readFile(path.resolve(distDir, file), 'utf-8')
      if (path.extname(file) === '.js') {
        assertJsContent(file, content)
        continue
      }
      expect(content).toMatchSnapshot(file)
    }
    expect(logger.success).toHaveBeenCalled()
  })
})

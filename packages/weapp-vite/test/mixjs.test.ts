import { fs } from '@weapp-core/shared/fs'
// import logger from '@/logger'
import CI from 'ci-info'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { getFixture, scanFiles } from './utils'

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

describe.skipIf(CI.isCI)('build', () => {
  const cwd = getFixture('mixjs')
  const distDir = path.resolve(cwd, 'dist')
  const expectedCoreFiles = [
    'app.js',
    'app.json',
    'components/custom-bar/index.js',
    'components/custom-bar/index.json',
    'components/custom-bar/index.wxml',
    'components/custom-bar1/index.js',
    'components/custom-bar1/index.json',
    'components/custom-bar1/index.wxml',
    'components/custom-bar2/index.js',
    'components/custom-bar2/index.json',
    'components/custom-bar2/index.wxml',
    'import/a.wxml',
    'packageA/entry.js',
    'packageA/pages/cat.js',
    'packageA/pages/cat.wxml',
    'packageA/pages/dog.js',
    'packageA/pages/dog.wxml',
    'packageB/pages/apple.js',
    'packageB/pages/apple.wxml',
    'packageB/pages/banana.js',
    'packageB/pages/banana.wxml',
    'pages/case0.js',
    'pages/case0.json',
    'pages/case0.wxml',
    'pages/index.js',
    'pages/index.json',
    'pages/index.wxml',
  ]

  const expectedLocalizedNpmFiles = [
    'miniprogram_npm/tdesign-miniprogram/button/button.js',
    'miniprogram_npm/tdesign-miniprogram/button/button.json',
    'miniprogram_npm/tdesign-miniprogram/button/button.wxml',
    'miniprogram_npm/tdesign-miniprogram/divider/divider.js',
    'miniprogram_npm/tdesign-miniprogram/divider/divider.json',
    'miniprogram_npm/tdesign-miniprogram/divider/divider.wxml',
  ]

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
    expect(files).toEqual(expect.arrayContaining(expectedCoreFiles))
    expect(files).toEqual(expect.arrayContaining(expectedLocalizedNpmFiles))

    const appJson = await fs.readJson(path.resolve(distDir, 'app.json'))
    expect(appJson.usingComponents['t-divider']).toBe('./miniprogram_npm/tdesign-miniprogram/divider/divider')

    const pageJson = await fs.readJson(path.resolve(distDir, 'pages/index.json'))
    expect(pageJson.usingComponents['t-button']).toBe('../miniprogram_npm/tdesign-miniprogram/button/button')
  })
})

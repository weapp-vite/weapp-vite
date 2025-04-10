import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { getFixture, scanFiles } from '../utils'

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
  beforeAll(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()

    expect(await fs.exists(distDir)).toBe(true)
  })

  it('abs import src', async () => {
    expect(await fs.exists(path.resolve(distDir, 'import/a.wxml'))).toBe(true)
  })
})

describe.skipIf(CI.isCI)('build basic', {
  timeout: 100000,
}, () => {
  const cwd = getFixture('basic')
  const distDir = path.resolve(cwd, 'dist')
  beforeAll(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
    expect(logger.warn).toHaveBeenCalledWith(`没有找到 pages/index/vue 的入口文件，请检查路径是否正确!`)
    expect(await fs.exists(distDir)).toBe(true)
  })

  it('dist', async () => {
    expect(await fs.exists(path.resolve(distDir))).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    for (const file of files) {
      const content = await fs.readFile(path.resolve(distDir, file), 'utf-8')
      expect(content).toMatchSnapshot(file)
    }
  })
})

describe.skipIf(CI.isCI)('tabbar-appbar', () => {
  const cwd = getFixture('tabbar-appbar')
  const distDir = path.resolve(cwd, 'dist')
  beforeAll(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
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

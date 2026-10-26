import { fs } from '@weapp-core/shared/fs'
import CI from 'ci-info'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { createBundleRuntime, readBundleOutputs } from './bundleRuntime'
import { getFixture, normalizeBuildOutputContent, scanFiles } from './utils'

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

describe.skipIf(CI.isCI)('build basic', {
  timeout: 100000000,
}, () => {
  const cwd = getFixture('basic')
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
    const outputs = await readBundleOutputs(distDir, files)
    const nonJsOutputs = outputs.filter(({ file }) => !file.endsWith('.js'))
    expect(nonJsOutputs.map(({ file }) => file)).toMatchSnapshot()
    for (const { file, content } of nonJsOutputs) {
      expect(normalizeBuildOutputContent(content)).toMatchSnapshot(file)
    }
    const runtime = createBundleRuntime(outputs)
    runtime.assertDependencyGraph()
    runtime.assertAppAndNavbar()
    runtime.load('pages/index/index.js')
    expect(runtime.page).toHaveBeenCalledTimes(1)
    const definition = runtime.page.mock.calls[0]![0]
    expect(Object.keys(definition)).toEqual(['data'])
    const data = definition.data as { Test: new () => { x: string } }
    expect(Object.keys(data)).toEqual(['Test'])
    expect(new data.Test()).toEqual({ x: '1' })
    runtime.assertAllScriptsReachable()
  })
})

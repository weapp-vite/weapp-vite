import { readFile, rm, stat } from 'node:fs/promises'
import vm from 'node:vm'
import CI from 'ci-info'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { getFixture, normalizeBuildOutputContent, scanFiles } from './utils'

interface FixtureDefinition {
  onLoad?: () => Promise<void>
  lifetimes?: { attached?: () => Promise<void> }
}

async function assertBundleRuntime(outputs: Array<{ file: string, content: string }>) {
  const sources = new Map(outputs.filter(({ file }) => path.extname(file) === '.js').map(({ file, content }) => [file, content]))
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const app = vi.fn()
  const page = vi.fn<(definition: FixtureDefinition) => void>()
  const component = vi.fn<(definition: FixtureDefinition) => void>()
  const log = vi.fn()
  const context = vm.createContext({
    App: app,
    Page: page,
    Component: component,
    Behavior: (definition: unknown) => definition,
    wx: {},
    console: { log, warn: vi.fn(), error: vi.fn() },
  })

  // 使用产物自己的依赖路径和缓存执行，兼容共享模块独立成块或与 runtime 合并。
  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file)
    if (cached) {
      return cached.exports
    }
    const source = sources.get(file)
    if (source === undefined) {
      throw new Error(`Unresolved fixture bundle dependency: ${file}`)
    }
    const module = { exports: {} }
    modules.set(file, module)
    const requireModule = (specifier: string) => {
      if (!specifier.startsWith('.')) {
        throw new Error(`Unexpected external fixture dependency: ${specifier}`)
      }
      return load(path.normalize(path.join(path.dirname(file), specifier)))
    }
    const require = Object.assign(requireModule, {
      async: async (specifier: string) => requireModule(specifier),
    })
    const execute = vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context, { filename: file })
    execute(require, module, module.exports)
    return module.exports
  }

  load('app.js')
  expect(app).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ globalData: {} }))
  load('pages/index/index.js')
  expect(page).toHaveBeenCalledTimes(1)
  const pageDefinition = page.mock.calls[0]![0]
  expect(pageDefinition.onLoad).toBeTypeOf('function')
  await pageDefinition.onLoad!()
  expect(log).toHaveBeenLastCalledWith('part', 'other', { async: 'async', default: 1 }, { async2: 'async2', default: 2 })

  component.mockClear()
  load('custom-tab-bar/index.js')
  expect(component).toHaveBeenCalledTimes(1)
  const tabBar = component.mock.calls[0]![0]
  expect(tabBar.lifetimes?.attached).toBeTypeOf('function')
  log.mockClear()
  await tabBar.lifetimes!.attached!()
  expect(log.mock.calls).toEqual([[{ other: 'other' }], [{ async: 'async', default: 1 }]])

  component.mockClear()
  load('components/Navbar/Navbar.js')
  expect(component).toHaveBeenCalledTimes(1)
  const navbar = component.mock.calls[0]![0]
  expect(navbar.lifetimes?.attached).toBeTypeOf('function')
  await navbar.lifetimes!.attached!()
  expect(log).toHaveBeenLastCalledWith({ async: 'async', default: 1 })

  for (const file of ['app-bar/index.js', 'components/Test/index.js', 'pages/index/vue.js', 'pages/index/vue-setup.js']) {
    component.mockClear()
    load(file)
    expect(component, `${file} registers its component`).toHaveBeenCalledTimes(1)
  }
  expect(page).toHaveBeenCalledTimes(1)
  expect(app).toHaveBeenCalledTimes(1)
  expect([...modules.keys()].sort(), 'All emitted JavaScript is reachable through fixture entries').toEqual([...sources.keys()].sort())
}

vi.mock('@/logger', () => ({
  default: {
    warn: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  configureLogger: vi.fn(),
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
    const outputs = await Promise.all(files.map(async file => ({
      content: await readFile(path.resolve(distDir, file), 'utf-8'),
      file,
    })))
    const nonJsOutputs = outputs.filter(({ file }) => path.extname(file) !== '.js')
    expect(nonJsOutputs.map(({ file }) => file).sort()).toMatchSnapshot()
    for (const { content, file } of nonJsOutputs) {
      expect(normalizeBuildOutputContent(content)).toMatchSnapshot(file)
    }
    await assertBundleRuntime(outputs)
    expect(logger.success).toHaveBeenCalled()
  })
})

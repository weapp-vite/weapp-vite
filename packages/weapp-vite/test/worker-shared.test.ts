import { runInNewContext } from 'node:vm'
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

function executeWorker(entry: string, sources: Map<string, string>) {
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const dependencies = new Set<string>()
  const handlers: Array<(message: unknown) => void> = []
  const log = vi.fn()

  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file)
    if (cached) {
      return cached.exports
    }
    const source = sources.get(file)
    if (source === undefined) {
      throw new Error(`Worker dependency was not emitted: ${file}`)
    }
    const module = { exports: {} }
    modules.set(file, module)
    // 只在测试侧执行真实产物，依赖仅能解析到本轮生成的 worker 文件。
    runInNewContext(source, {
      module,
      exports: module.exports,
      console: { log },
      worker: { onMessage(handler: (message: unknown) => void) { handlers.push(handler) } },
      require(specifier: string) {
        expect(specifier.startsWith('./') || specifier.startsWith('../')).toBe(true)
        const dependency = path.normalize(path.join(path.dirname(file), specifier))
        expect(dependency.startsWith('workers/')).toBe(true)
        dependencies.add(dependency)
        return load(dependency)
      },
    }, { filename: file, timeout: 1000 })
    return module.exports
  }

  load(entry)
  expect(handlers).toHaveLength(1)
  const message = { value: 'worker-message' }
  handlers[0]!(message)
  expect(log).toHaveBeenCalledTimes(1)
  expect(log.mock.calls[0]![0]).toBe(message)
  return { modules, dependencies, logged: log.mock.calls[0]! }
}

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
  }, 30_000)

  it('dist', async () => {
    expect(await fs.exists(path.resolve(distDir))).toBe(true)

    const files = await scanFiles(distDir)
    const isWorkerScript = (file: string) => file.startsWith('workers/') && file.endsWith('.js')
    expect(files.filter(file => !file.endsWith('.js'))).toMatchSnapshot()
    const outputs = await readBundleOutputs(distDir, files)
    const workerSources = new Map<string, string>()
    for (const { file, content } of outputs) {
      if (isWorkerScript(file)) {
        workerSources.set(file, content)
      }
      else if (!file.endsWith('.js')) {
        expect(normalizeBuildOutputContent(content)).toMatchSnapshot(file)
      }
    }

    const runtime = createBundleRuntime(outputs.filter(({ file }) => !isWorkerScript(file)))
    runtime.assertDependencyGraph()
    runtime.assertAppAndNavbar()
    runtime.load('pages/index/index.js')
    expect(runtime.page).toHaveBeenCalledExactlyOnceWith({})
    runtime.assertAllScriptsReachable()

    const index = executeWorker('workers/index.js', workerSources)
    const hello = executeWorker('workers/hello.js', workerSources)
    expect(index.logged).toHaveLength(3)
    expect(index.logged[1]).toEqual({ a: 1 })
    expect(hello.logged).toHaveLength(2)
    const sharedModules = ([[index, index.logged[2]], [hello, hello.logged[1]]] as const).map(([runtime, exportedHello]) => {
      expect(exportedHello).toBeTypeOf('function')
      expect((exportedHello as () => unknown)()).toBe('world')
      return [...runtime.dependencies].filter(file => runtime.modules.get(file)?.exports.hello === exportedHello)
    })
    expect(sharedModules[0]).toHaveLength(1)
    expect(sharedModules[1]).toEqual(sharedModules[0])
    expect([...workerSources.keys()].sort()).toEqual([...new Set([...index.modules.keys(), ...hello.modules.keys()])].sort())
    expect(logger.success).toHaveBeenCalled()
  })
})

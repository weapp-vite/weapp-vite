import vm from 'node:vm'
import { fs } from '@weapp-core/shared/fs'
import { parse, traverse } from '@weapp-vite/ast'
import path from 'pathe'

export interface BundleOutput {
  file: string
  content: string
}

export async function readBundleOutputs(distDir: string, files: string[]): Promise<BundleOutput[]> {
  return Promise.all(files.map(async file => ({
    file,
    content: await fs.readFile(path.join(distDir, file), 'utf8'),
  })))
}

export function createBundleRuntime(
  outputs: BundleOutput[],
  mapDependency: (exports: Record<string, unknown>) => Record<string, unknown> = exports => exports,
) {
  const sources = new Map(outputs.filter(({ file }) => file.endsWith('.js')).map(({ file, content }) => [file, content]))
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const app = vi.fn<(definition: Record<string, unknown>) => void>()
  const page = vi.fn<(definition: Record<string, unknown>) => void>()
  const component = vi.fn<(definition: Record<string, unknown>) => void>()
  const log = vi.fn()
  const context = vm.createContext({
    App: app,
    Page: page,
    Component: component,
    Behavior: (definition: unknown) => definition,
    wx: {},
    console: { log, warn: vi.fn(), error: vi.fn() },
  })

  function resolve(file: string, specifier: string) {
    if (!specifier.startsWith('.')) {
      throw new Error(`Unexpected external fixture dependency: ${specifier}`)
    }
    const target = path.normalize(path.join(path.dirname(file), specifier))
    const resolved = [target, `${target}.js`, `${target}/index.js`].find(candidate => sources.has(candidate))
    if (!resolved) {
      throw new Error(`Unresolved fixture dependency: ${file} -> ${specifier}`)
    }
    return resolved
  }

  // 按产物真实依赖图执行；共享块名和打包器局部变量都不是测试契约。
  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file)
    if (cached) {
      return cached.exports
    }
    const source = sources.get(file)
    if (source === undefined) {
      throw new Error(`Fixture script was not emitted: ${file}`)
    }
    const module = { exports: {} }
    modules.set(file, module)
    const requireModule = (specifier: string) => mapDependency(load(resolve(file, specifier)))
    const require = Object.assign(requireModule, { async: async (specifier: string) => requireModule(specifier) })
    const execute = vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context, { filename: file, timeout: 1000 })
    execute(require, module, module.exports)
    return module.exports
  }

  function assertDependencyGraph(publicEntries?: readonly string[]) {
    const dependencies = new Map<string, Set<string>>()
    for (const [file, source] of sources) {
      const targets = new Set<string>()
      dependencies.set(file, targets)
      traverse(parse(source), {
        CallExpression({ node }) {
          const request = node.arguments[0]
          if (node.callee.type === 'Identifier' && node.callee.name === 'require'
            && request?.type === 'StringLiteral' && request.value.startsWith('.')) {
            const target = resolve(file, request.value)
            expect(sources.has(target)).toBe(true)
            targets.add(target)
          }
        },
      })
    }
    if (publicEntries) {
      const reached = new Set<string>()
      const pending = [...publicEntries]
      while (pending.length) {
        const file = pending.pop()!
        expect(sources.has(file), `Public fixture entry was emitted: ${file}`).toBe(true)
        if (reached.has(file)) {
          continue
        }
        reached.add(file)
        pending.push(...dependencies.get(file)!)
      }
      expect([...reached].sort(), 'All scripts are reachable from public entries').toEqual([...sources.keys()].sort())
    }
  }

  function assertAppAndNavbar() {
    load('app.js')
    expect(app).toHaveBeenCalledTimes(1)
    const definition = app.mock.calls[0]![0]
    expect(Object.keys(definition).sort()).toEqual(['globalData', 'onLaunch'])
    expect(definition.globalData).toEqual({})
    expect(definition.onLaunch).toBeTypeOf('function')
    expect((definition.onLaunch as () => unknown)()).toBeUndefined()
    load('components/Navbar/Navbar.js')
    expect(component).toHaveBeenCalledExactlyOnceWith({})
  }

  function assertAllScriptsReachable() {
    expect([...modules.keys()].sort(), 'All scripts are reachable from public entries').toEqual([...sources.keys()].sort())
  }

  return { app, page, component, log, load, assertDependencyGraph, assertAppAndNavbar, assertAllScriptsReachable }
}

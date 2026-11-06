import { describe, expect, it, vi } from 'vitest'
import { runnerHarness } from './taroHarmony/testHarness'

function compilerHarness() {
  const harness = runnerHarness()
  const plugin = new harness.MiniPlugin(harness.args[0])
  const compilation = {}
  const compiler = {}
  harness.runner.mockImplementation(async (_appPath, config) => {
    await config.onCompilerMake(compilation, compiler, plugin)
    return harness.result
  })
  return { ...harness, plugin, compilation, compiler }
}

describe('frozen Harmony JSUI STATIC dependency lookup protocol', () => {
  it('exposes the unique official STATIC instance through a temporary get view without adding entries', async () => {
    const harness = compilerHarness()
    const source = 'src/container.js'
    const dependency = new harness.SingleEntryDependency(source, 'container/index', harness.META_TYPE.STATIC)
    const original = harness.plugin.dependencies
    const callback = vi.fn(async (compilation, compiler, plugin) => {
      expect(compilation).toBe(harness.compilation)
      expect(compiler).toBe(harness.compiler)
      expect(plugin).toBe(harness.plugin)
      expect(plugin.dependencies).toBeInstanceOf(Map)
      expect(plugin.dependencies).not.toBe(original)
      // 官方 addEntry 仍通过原 Map 写入，兼容视图只扩展 get 的读取协议。
      expect(plugin.dependencies.set(`${source}#container/index`, dependency)).toBe(original)
      expect(plugin.dependencies.get(source)).toBe(dependency)
      expect(plugin.dependencies.get(`${source}#container/index`)).toBe(dependency)
      expect(plugin.dependencies.has(source)).toBe(false)
      expect(plugin.dependencies.size).toBe(1)
      expect([...plugin.dependencies]).toEqual([[`${source}#container/index`, dependency]])
      expect([...plugin.dependencies.keys()]).toEqual([`${source}#container/index`])
      expect([...plugin.dependencies.values()]).toEqual([dependency])
      const entries: unknown[] = []
      plugin.dependencies.forEach((value: unknown, key: unknown, map: unknown) => entries.push([key, value, map]))
      expect(entries).toEqual([[`${source}#container/index`, dependency, original]])
      return harness.result
    })
    harness.config.onCompilerMake = callback
    await expect(harness.run()).resolves.toBe(harness.result)
    expect(callback).toHaveBeenCalledOnce()
    expect(harness.plugin.dependencies).toBe(original)
    expect(original.size).toBe(1)
    expect(original.get(source)).toBeUndefined()
    expect(JSON.parse(harness.report.mock.calls[0]![0] as string)).toEqual({ event: 'template-corpus-harmony-jsui-static-dependency', mode: 'development', entryName: 'container/index', keyProtocol: 'request-to-static-entry' })
  })

  it('preserves exact Map keys, missing values and non-string keys before considering a fallback', async () => {
    const harness = compilerHarness()
    const source = 'src/container.js'
    const dependency = new harness.SingleEntryDependency(source, 'container/index', harness.META_TYPE.STATIC)
    const key = {}
    harness.plugin.dependencies.set(`${source}#container/index`, dependency)
    harness.plugin.dependencies.set(source, undefined)
    harness.plugin.dependencies.set(key, dependency)
    harness.config.onCompilerMake = async (_compilation, _compiler, plugin) => {
      expect(plugin.dependencies.get(source)).toBeUndefined()
      expect(plugin.dependencies.get(key)).toBe(dependency)
      expect(plugin.dependencies.get(Symbol('missing'))).toBeUndefined()
      expect(plugin.dependencies.delete(key)).toBe(true)
      expect(plugin.dependencies.has(key)).toBe(false)
    }
    await harness.run()
    expect(harness.report).not.toHaveBeenCalled()
  })

  it.each(['missing', 'ambiguous', 'non-static', 'foreign'])('does not hide the original missing lookup for %s dependencies', async (kind) => {
    const harness = compilerHarness()
    const source = 'src/container.js'
    if (kind === 'ambiguous') {
      harness.plugin.dependencies.set(`${source}#one`, new harness.SingleEntryDependency(source, 'one', harness.META_TYPE.STATIC))
      harness.plugin.dependencies.set(`${source}#two`, new harness.SingleEntryDependency(source, 'two', harness.META_TYPE.STATIC))
    }
    if (kind === 'non-static') {
      harness.plugin.dependencies.set(`${source}#page`, new harness.SingleEntryDependency(source, 'page', harness.META_TYPE.PAGE))
    }
    if (kind === 'foreign') {
      harness.plugin.dependencies.set(`${source}#foreign`, { request: source, name: 'foreign', miniType: harness.META_TYPE.STATIC })
    }
    const original = harness.plugin.dependencies
    const before = [...original]
    harness.config.onCompilerMake = async (_compilation, _compiler, plugin) => {
      expect(plugin.dependencies.get(source)).toBeUndefined()
    }
    await harness.run()
    expect(harness.plugin.dependencies).toBe(original)
    expect([...original]).toEqual(before)
    expect(harness.report).not.toHaveBeenCalled()
  })

  it('restores the exact Map on callback rejection and preserves the official error', async () => {
    const harness = compilerHarness()
    const original = harness.plugin.dependencies
    const error = new Error('official compiler-make failed')
    harness.config.onCompilerMake = async (_compilation, _compiler, plugin) => {
      expect(plugin.dependencies).not.toBe(original)
      await Promise.resolve()
      throw error
    }
    await expect(harness.run()).rejects.toBe(error)
    expect(harness.plugin.dependencies).toBe(original)
  })

  it('creates a fresh view for each callback and rejects a changed dependency container', async () => {
    const harness = compilerHarness()
    const original = harness.plugin.dependencies
    const views: Map<unknown, unknown>[] = []
    harness.config.onCompilerMake = async (_compilation, _compiler, plugin) => {
      views.push(plugin.dependencies)
    }
    await harness.run()
    await harness.run()
    expect(views).toHaveLength(2)
    expect(views[0]).not.toBe(views[1])
    expect(harness.plugin.dependencies).toBe(original)
    harness.plugin.dependencies = {} as Map<unknown, unknown>
    await expect(harness.run()).rejects.toThrow('genuine dependency Map')
  })
})

import type { Plugin, ResolvedConfig } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { createAutoImportBuildDiagnosticsPlugin, normalizeBuildDiagnosticText } from './hooks'

type Callable = (this: unknown, ...args: unknown[]) => unknown

function instrument(target: Plugin, options: Parameters<typeof createAutoImportBuildDiagnosticsPlugin>[1]) {
  const diagnostics = createAutoImportBuildDiagnosticsPlugin(true, options)!
  const configure = diagnostics.configResolved as Callable
  configure({ plugins: [target, diagnostics] } as unknown as ResolvedConfig)
  return { diagnostics, configure }
}

function handler(hook: unknown) {
  return (typeof hook === 'function' ? hook : (hook as { handler: Callable }).handler) as Callable
}

afterEach(() => vi.restoreAllMocks())

it('does not read options, clocks or return a promise when disabled', () => {
  const access = vi.fn(() => {
    throw new Error('disabled diagnostic accessor')
  })
  expect(createAutoImportBuildDiagnosticsPlugin(false, { roots: [], get now() {
    return access()
  }, get observe() {
    return access()
  } })).toBeUndefined()
  expect(access).not.toHaveBeenCalled()
})

it('preserves synchronous values, context and arguments without changing function hook metadata', () => {
  const owner = { result: { source: 'original' } }
  const original = Object.assign(vi.fn(function (this: typeof owner, source: string, id: string) {
    expect(source).toBe('source')
    expect(id).toBe('/checkout/project/src/index.ts?vue')
    return this.result
  }), { filter: { id: /\.ts/ } })
  const target = { name: 'source', transform: original } as unknown as Plugin
  const observe = vi.fn()
  const now = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(27)
  instrument(target, { roots: [{ path: '/checkout/project', label: '<project>' }], now, timeOrigin: () => 1_000, observe })

  expect(handler(target.transform).call(owner, 'source', '/checkout/project/src/index.ts?vue')).toBe(owner.result)
  expect((target.transform as unknown as { filter: unknown }).filter).toBe(original.filter)
  expect(original).toHaveBeenCalledOnce()
  expect(observe.mock.calls.map(([event]) => event)).toEqual([
    { id: 1, pluginIndex: 0, pluginName: 'source', hookName: 'transform', moduleId: '<project>/src/index.ts?vue', status: 'started', timeOrigin: 1_000, startedAtMs: 20 },
    { id: 1, pluginIndex: 0, pluginName: 'source', hookName: 'transform', moduleId: '<project>/src/index.ts?vue', status: 'completed', timeOrigin: 1_000, startedAtMs: 20, endedAtMs: 27, elapsedMs: 7 },
  ])
})

it('preserves object hook filtering, order, sequential scheduling and the original object', async () => {
  const result = { output: 'original bundle' }
  const context = { marker: 'context' }
  const original = vi.fn(function (this: typeof context, arg: unknown) {
    expect(this).toBe(context)
    expect(arg).toBe(result)
    return Promise.resolve(result)
  })
  const hook = { filter: { id: /src/ }, order: 'post' as const, sequential: true, handler: original }
  const target = { name: 'publication', generateBundle: hook } as unknown as Plugin
  const observe = vi.fn()
  const { configure, diagnostics } = instrument(target, { roots: [], observe })
  const wrapped = target.generateBundle as unknown as typeof hook
  expect(wrapped).toMatchObject({ order: 'post', sequential: true })
  expect(wrapped.filter).toBe(hook.filter)
  expect(hook.handler).toBe(original)
  expect(wrapped.handler).not.toBe(original)
  configure({ plugins: [target, diagnostics] })
  expect(target.generateBundle).toBe(wrapped)
  await expect(wrapped.handler.call(context, result)).resolves.toBe(result)
  expect(observe.mock.calls.map(([event]) => event.status)).toEqual(['started', 'completed'])
})

it.each(['throw', 'rejection'] as const)('preserves the original %s even when every sink call throws', async (kind) => {
  const failure = new Error('original compiler error')
  const target = { name: 'source', load() {
    if (kind === 'throw') {
      throw failure
    }
    return Promise.reject(failure)
  } } as Plugin
  instrument(target, { roots: [], observe() {
    throw new Error('diagnostic sink')
  } })
  if (kind === 'throw') {
    expect(() => handler(target.load)('/external/source.ts')).toThrow(failure)
  }
  else {
    await expect(handler(target.load)('/external/source.ts')).rejects.toBe(failure)
  }
})

it('does not replace success when the receiver throws', () => {
  const result = { code: 'original' }
  const target = { name: 'source', load: () => result } as unknown as Plugin
  instrument(target, { roots: [], observe() {
    throw new Error('diagnostic sink')
  } })
  expect(handler(target.load)('virtual:source')).toBe(result)
})

it.each(['now', 'timeOrigin'] as const)('preserves the original promise identity when initial %s fails', async (clock) => {
  const result = Promise.resolve('original')
  const target = { name: 'source', load: () => result } as unknown as Plugin
  const fail = () => {
    throw new Error('initial clock')
  }
  const observe = vi.fn()
  instrument(target, { roots: [], [clock]: fail, observe })
  expect(handler(target.load)('virtual:source')).toBe(result)
  await expect(result).resolves.toBe('original')
  expect(observe).not.toHaveBeenCalled()
})

it.each(['success', 'throw', 'rejection'] as const)('preserves original %s when the finish clock fails', async (kind) => {
  const failure = new Error('original compiler failure')
  const result = { code: 'original' }
  const target = { name: 'source', load() {
    if (kind === 'throw') {
      throw failure
    }
    return kind === 'rejection' ? Promise.reject(failure) : result
  } } as unknown as Plugin
  const observe = vi.fn()
  const now = vi.fn().mockReturnValueOnce(10).mockImplementationOnce(() => {
    throw new Error('finish clock')
  })
  instrument(target, { roots: [], now, observe })
  if (kind === 'throw') {
    expect(() => handler(target.load)('virtual:source')).toThrow(failure)
  }
  else if (kind === 'rejection') {
    await expect(handler(target.load)('virtual:source')).rejects.toBe(failure)
  }
  else {
    expect(handler(target.load)('virtual:source')).toBe(result)
  }
  expect(observe).toHaveBeenCalledOnce()
  expect(observe.mock.calls[0]![0]).toMatchObject({ status: 'started' })
})

it('normalizes both platform separators and chooses the narrowest root while preserving virtual ids', () => {
  const roots = [{ path: 'C:\\workspace', label: '<checkout>' }, { path: 'C:\\workspace\\fixture', label: '<project>' }]
  expect(normalizeBuildDiagnosticText('C:\\workspace\\fixture\\src\\index.ts?vue\nC:\\workspace\\node_modules\\pkg', roots)).toBe('<project>/src/index.ts?vue\n<checkout>/node_modules/pkg')
  expect(normalizeBuildDiagnosticText('\0weapp:entry?x=1', roots)).toBe('\0weapp:entry?x=1')
})

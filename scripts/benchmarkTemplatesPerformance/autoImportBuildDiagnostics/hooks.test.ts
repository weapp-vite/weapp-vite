import type { Plugin, ResolvedConfig } from 'vite'
import { Writable } from 'node:stream'
import { afterEach, expect, it, vi } from 'vitest'
import { AUTO_IMPORT_BUILD_HOOK_PREFIX, createAutoImportBuildDiagnosticsPlugin, normalizeBuildDiagnosticText } from './hooks'
import { readBuildHookEvidence } from './output'

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

it('finishes once after buffered hook callbacks and its terminal callback drain', async () => {
  const lines: string[] = []
  const callbacks: Array<() => void> = []
  const output = new Writable({ highWaterMark: 1, write(chunk, _encoding, callback) {
    lines.push(String(chunk))
    callbacks.push(callback)
  } })
  const target = { name: 'source', load: () => 'original' } as unknown as Plugin
  const { diagnostics } = instrument(target, { roots: [], output, timeOrigin: () => 1_000, now: () => 10 })
  expect(handler(target.load)('virtual:source')).toBe('original')
  expect(diagnostics.closeBundle).toMatchObject({ order: 'post', sequential: true })
  const closing = handler(diagnostics.closeBundle)() as Promise<void>
  expect(handler(diagnostics.closeBundle)()).toBe(closing)
  let closed = false
  void closing.then(() => closed = true)
  callbacks.shift()!()
  await Promise.resolve()
  expect(lines).toHaveLength(2)
  expect(closed).toBe(false)
  callbacks.shift()!()
  await Promise.resolve()
  expect(lines).toHaveLength(3)
  expect(closed).toBe(false)
  callbacks.shift()!()
  await closing
  expect(readBuildHookEvidence(lines.join('')).errors).toEqual([])
  expect(readBuildHookEvidence(lines.join('')).terminal).toMatchObject({ lastAssignedId: 1, pendingIds: [], drained: true, finalCloseHook: true })
  expect(output.listenerCount('error')).toBe(0)
})

it('does not claim pending hooks as completed or accept records after its terminal', async () => {
  let resolve: (value: string) => void = () => {}
  const result = new Promise<string>((accept) => {
    resolve = accept
  })
  const target = { name: 'source', load: () => result } as unknown as Plugin
  const events: object[] = []
  const { diagnostics } = instrument(target, { roots: [], observe: event => events.push(event) })
  const original = handler(target.load)('virtual:pending')
  await handler(diagnostics.closeBundle)()
  expect(events).toHaveLength(2)
  expect(events[1]).toMatchObject({ kind: 'producer-end', lastAssignedId: 1, pendingIds: [1] })
  resolve('original')
  await expect(original).resolves.toBe('original')
  const evidence = readBuildHookEvidence(events.map(event => `${AUTO_IMPORT_BUILD_HOOK_PREFIX}${JSON.stringify(event)}`).join('\n'))
  expect(evidence.errors).toContain('Incomplete producer terminal boundary')
  expect(evidence.errors).toContain('Hook event follows producer terminal: 1')
})

it('checks final post close order without moving any production plugin', async () => {
  const observe = vi.fn()
  const firstClose = vi.fn(() => {})
  const lastClose = vi.fn(() => {})
  const first = { name: 'first', closeBundle: { order: 'post', sequential: true, handler: firstClose } } as Plugin
  const last = { name: 'last', closeBundle: { order: 'post', handler: lastClose } } as Plugin
  const { diagnostics, configure } = instrument(first, { roots: [], observe })
  const plugins = [first, diagnostics, last]
  configure({ plugins })
  expect(plugins).toEqual([first, diagnostics, last])
  expect(handler(first.closeBundle)()).toBeUndefined()
  expect(firstClose).toHaveBeenCalledOnce()
  await handler(diagnostics.closeBundle)()
  expect(observe.mock.calls.at(-1)![0]).toMatchObject({ kind: 'producer-end', finalCloseHook: false })
  expect(handler(last.closeBundle)()).toBeUndefined()
  expect(lastClose).toHaveBeenCalledOnce()
  const evidence = readBuildHookEvidence(observe.mock.calls.map(([event]) => `${AUTO_IMPORT_BUILD_HOOK_PREFIX}${JSON.stringify(event)}`).join('\n'))
  expect(evidence.errors).toContain('Incomplete producer terminal boundary')
  expect(evidence.errors).toContain('Hook event follows producer terminal: 2')
})

it('keeps stream failure incomplete without hanging close or replacing the compiler error', async () => {
  const callbacks: Array<() => void> = []
  const output = new Writable({ write(_chunk, _encoding, callback) {
    callbacks.push(callback)
  } })
  const failure = new Error('original compiler error')
  const target = { name: 'source', load() {
    throw failure
  } } as Plugin
  const { diagnostics } = instrument(target, { roots: [], output })
  expect(() => handler(target.load)('virtual:source')).toThrow(failure)
  const closing = handler(diagnostics.closeBundle)() as Promise<void>
  output.emit('error', new Error('diagnostic output error'))
  await expect(closing).resolves.toBeUndefined()
  callbacks.shift()!()
  callbacks.shift()!()
  expect(output.listenerCount('error')).toBe(0)
})

it.each(['success', 'throw', 'rejection'] as const)('keeps original %s intact across a later native Writable error', async (kind) => {
  const streamFailure = new Error('asynchronous diagnostic write error')
  let finishDestroy: (() => void) | undefined
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      queueMicrotask(() => callback(streamFailure))
    },
    destroy(error, callback) {
      finishDestroy = () => callback(error)
    },
  })
  const failure = new Error('original compiler error')
  const result = { code: 'original' }
  const target = { name: 'source', load() {
    if (kind === 'throw') {
      throw failure
    }
    return kind === 'rejection' ? Promise.reject(failure) : result
  } } as unknown as Plugin
  const { diagnostics } = instrument(target, { roots: [], output })
  if (kind === 'throw') {
    expect(() => handler(target.load)('virtual:source')).toThrow(failure)
  }
  else if (kind === 'rejection') {
    await expect(handler(target.load)('virtual:source')).rejects.toBe(failure)
  }
  else {
    expect(handler(target.load)('virtual:source')).toBe(result)
  }
  await expect(handler(diagnostics.closeBundle)()).resolves.toBeUndefined()
  expect(output.listenerCount('error')).toBe(1)
  finishDestroy!()
  await new Promise(resolve => setImmediate(resolve))
  expect(output.listenerCount('error')).toBe(0)
  expect(output.listenerCount('drain')).toBe(0)
})

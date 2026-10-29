import type { FSWatcher } from 'chokidar'
import type { InlineConfig, ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import * as fileWatchers from '../../runtime/watch/fileWatcher'
import { beginWxmlDependencies } from './dependencies'
import { bindWxmlDependencyWatch, ownsExternalWxmlWatch } from './watch'

const { watchMock } = vi.hoisted(() => ({ watchMock: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: watchMock } }))

beforeEach(() => {
  watchMock.mockReset()
  vi.stubEnv('CHOKIDAR_USEPOLLING', undefined)
  vi.stubEnv('CHOKIDAR_INTERVAL', undefined)
  vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', undefined)
})
afterEach(() => vi.unstubAllEnvs())

function fixture(disabled = false, options: {
  watch?: Record<string, unknown>
  inlineConfig?: InlineConfig
  withoutConfigService?: boolean
} = {}) {
  const watcher = Object.assign(new EventEmitter(), {
    add: vi.fn(),
    close: vi.fn(async () => {}),
  })
  watchMock.mockImplementation(() => {
    queueMicrotask(() => watcher.emit('ready'))
    return watcher as unknown as FSWatcher
  })
  const userIgnored = vi.fn(() => false)
  const server = {
    config: { root: '/project', server: { watch: disabled ? null : { usePolling: true, interval: 30, ignored: userIgnored, ...options.watch } }, logger: { error: vi.fn() } },
    watcher: { add: vi.fn() },
  }
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { cwd: '/project', outDir: '/project/dist', inlineConfig: options.inlineConfig },
  } as unknown as CompilerContext
  const internal = '/project/rules.json'
  const external = '/inputs/rules.json'
  const initial = beginWxmlDependencies(ctx, 'main', false)
  const register = initial.template('initial.wxml')
  register(internal)
  register(external)
  initial.commit()
  const onChange = vi.fn()
  const close = bindWxmlDependencyWatch(
    options.withoutConfigService ? { runtimeState: ctx.runtimeState } : ctx,
    server as unknown as ViteDevServer,
    onChange,
  )
  return { watcher, userIgnored, server, ctx, internal, external, onChange, close }
}

describe('WXML dependency watcher ownership', () => {
  it('rolls back dependency observation and ownership when initial backend creation throws', async () => {
    const ctx = {
      runtimeState: createRuntimeState(),
      configService: { cwd: '/project', outDir: '/project/dist', inlineConfig: { weapp: { watch: { engine: 'parcel' } } } },
    } as unknown as CompilerContext
    const external = '/inputs/rules.json'
    const initial = beginWxmlDependencies(ctx, 'main', false)
    initial.template('initial.wxml')(external)
    initial.commit()
    const unrelated = vi.fn()
    ctx.runtimeState.wxmlProcessing.listeners.add(unrelated)
    const server = {
      config: { root: '/project', server: { watch: {} }, logger: { error: vi.fn() } },
    } as unknown as ViteDevServer
    const failure = new Error('backend creation failed')
    const fileWatcher = {
      ready: Promise.resolve('ready' as const),
      add: vi.fn(async () => 'ready' as const),
      updateTargets: vi.fn(async () => 'ready' as const),
      onChange: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      close: vi.fn(async () => {}),
    }
    const create = vi.spyOn(fileWatchers, 'createFileWatcher').mockImplementationOnce(() => {
      throw failure
    }).mockReturnValue(fileWatcher)
    try {
      expect(() => bindWxmlDependencyWatch(ctx, server, vi.fn())).toThrow(failure)
      expect(ctx.runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
      expect(ownsExternalWxmlWatch(ctx, external)).toBe(false)

      const next = beginWxmlDependencies(ctx, 'main', true)
      next.template('next.wxml')('/inputs/next.json')
      next.commit()
      expect(create).toHaveBeenCalledOnce()
      expect(unrelated).toHaveBeenCalledOnce()

      const close = bindWxmlDependencyWatch(ctx, server, vi.fn())
      try {
        await close.ready
        expect(ownsExternalWxmlWatch(ctx, external)).toBe(true)
        expect(create).toHaveBeenCalledTimes(2)
      }
      finally {
        await close()
      }
      expect(ctx.runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
      expect(ownsExternalWxmlWatch(ctx, external)).toBe(false)
      expect(fileWatcher.close).toHaveBeenCalledOnce()
    }
    finally {
      create.mockRestore()
    }
  })

  it('keeps the compiler watch engine when inheriting host watch options', async () => {
    const fileWatcher = {
      ready: Promise.resolve('ready' as const),
      add: vi.fn(async () => 'ready' as const),
      updateTargets: vi.fn(async () => 'ready' as const),
      onChange: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      close: vi.fn(async () => {}),
    }
    const create = vi.spyOn(fileWatchers, 'createFileWatcher').mockReturnValue(fileWatcher)
    const { close } = fixture(false, { inlineConfig: { weapp: { watch: { engine: 'parcel' } } } })
    try {
      await close.ready
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        inlineConfig: expect.objectContaining({ weapp: { watch: { engine: 'parcel' } } }),
      }), ['/inputs'], expect.any(Object))
      expect(watchMock).not.toHaveBeenCalled()
    }
    finally {
      await close()
      create.mockRestore()
    }
    expect(fileWatcher.close).toHaveBeenCalledOnce()
  })

  it('leaves root dependencies with the host through publication, removal and teardown', async () => {
    const { close, ctx, internal, server } = fixture()
    await close.ready
    const missing = '/project/missing-rules.json'
    try {
      // 缺失输入保留订阅以等待恢复，但不能反复创建与宿主根监听重叠的异步注册。
      for (const files of [[internal, missing], [missing], [internal, missing], []]) {
        for (const listener of ctx.runtimeState.wxmlProcessing.listeners) {
          listener(files)
        }
      }
    }
    finally {
      await close()
    }
    expect(server.watcher.add).not.toHaveBeenCalled()
  })

  it('watches only exact external inputs through shallow parents and preserves user options', async () => {
    const { watcher, userIgnored, server, ctx, internal, external, onChange, close } = fixture()
    await close.ready
    expect(server.watcher.add).not.toHaveBeenCalled()
    expect(watchMock).toHaveBeenCalledWith(['/inputs'], expect.any(Object))
    expect(watcher.add).not.toHaveBeenCalled()
    const options = watchMock.mock.calls[0]![1]
    expect(options).toMatchObject({ depth: 0, ignoreInitial: true, backend: 'polling', pollingInterval: 30 })
    expect(options.ignored[0]).toBe(userIgnored)
    const ignored = options.ignored[1]
    expect(ignored('/inputs')).toBe(false)
    expect(ignored(external)).toBe(false)
    expect(ignored('/inputs/unrelated.json')).toBe(false)
    expect(ignored('/inputs/nested', { isDirectory: () => true })).toBe(true)
    expect(ignored('/inputs/nested/rules.json')).toBe(true)
    expect(ownsExternalWxmlWatch(ctx, external)).toBe(true)
    expect(ownsExternalWxmlWatch(ctx, internal)).toBe(false)
    expect(ownsExternalWxmlWatch(ctx, '/inputs/unrelated.json')).toBe(false)
    watcher.emit('unlink', external)
    watcher.emit('add', external)
    watcher.emit('change', '/inputs/unrelated.json')
    expect(onChange.mock.calls.map(([event]) => event)).toEqual([
      { event: 'delete', file: external },
      { event: 'create', file: external },
    ])
    await close()
  })

  it('stops accepting released dependencies and disposes only its own subscription once', async () => {
    const { watcher, ctx, external, onChange, close } = fixture()
    await close.ready
    const unrelated = vi.fn()
    ctx.runtimeState.wxmlProcessing.listeners.add(unrelated)
    const replacement = beginWxmlDependencies(ctx, 'main', false)
    replacement.template('next.wxml')('/inputs/next.json')
    replacement.commit()
    watcher.emit('change', external)
    watcher.emit('change', '/inputs/next.json')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ event: 'update', file: '/inputs/next.json' })
    await close()
    await close()
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(ctx.runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
    expect(ownsExternalWxmlWatch(ctx, '/inputs/next.json')).toBe(false)
    watcher.emit('change', '/inputs/next.json')
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('preserves previous owners on incremental registration and releases only replaced templates', async () => {
    const { watcher, ctx, external, onChange, close } = fixture()
    await close.ready
    try {
      const next = '/inputs/next.json'
      const partial = beginWxmlDependencies(ctx, 'main', true)
      partial.template('next.wxml')(next)
      partial.commit()
      expect(ownsExternalWxmlWatch(ctx, external)).toBe(true)
      expect(ownsExternalWxmlWatch(ctx, next)).toBe(true)
      watcher.emit('change', external)
      watcher.emit('change', next)
      expect(onChange).toHaveBeenCalledTimes(2)

      const replacement = beginWxmlDependencies(ctx, 'main', true)
      replacement.template('initial.wxml')
      replacement.commit()
      expect(ownsExternalWxmlWatch(ctx, external)).toBe(false)
      expect(ownsExternalWxmlWatch(ctx, next)).toBe(true)
      watcher.emit('change', external)
      watcher.emit('change', next)
      expect(onChange).toHaveBeenCalledTimes(3)
      expect(watchMock).toHaveBeenCalledOnce()
      expect(watcher.add).not.toHaveBeenCalled()
    }
    finally {
      await close()
    }
  })

  it('respects disabled host watching', async () => {
    const { close } = fixture(true)
    await close.ready
    expect(watchMock).not.toHaveBeenCalled()
    await close()
  })

  it.each([
    {
      name: 'host write stability',
      watch: { awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 10 } },
      expected: { awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 10 } },
    },
    {
      name: 'host write stability defaults',
      watch: { awaitWriteFinish: true },
      expected: { awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 } },
    },
    {
      name: 'build backend and intervals before host polling options',
      inlineConfig: { build: { watch: { chokidar: { backend: 'native', pollingInterval: 25, pollingBinaryInterval: 50 } } } },
      watch: { usePolling: true, interval: 80, binaryInterval: 160 },
      expected: { backend: 'native', pollingInterval: 25, pollingBinaryInterval: 50 },
    },
    {
      name: 'explicit automatic backend before a legacy polling flag',
      watch: { backend: 'auto', usePolling: true, pollingInterval: 25, interval: 80, atomic: false, persistent: false },
      expected: { backend: 'auto', pollingInterval: 25, atomic: false, persistent: false },
    },
    {
      name: 'host polling options without a compiler config service',
      withoutConfigService: true,
      watch: { usePolling: true, interval: 40, binaryInterval: 80 },
      expected: { backend: 'polling', pollingInterval: 40, pollingBinaryInterval: 80 },
    },
    {
      name: 'host native selection without a compiler config service',
      withoutConfigService: true,
      watch: { usePolling: false },
      expected: { backend: 'native', pollingInterval: 30 },
    },
  ])('normalizes $name for Chokidar', async ({ expected, ...input }) => {
    const { close } = fixture(false, input)
    try {
      await close.ready
      const options = watchMock.mock.calls[0]![1]
      expect(options).toMatchObject({ ...expected, depth: 0, ignoreInitial: true })
      for (const alias of ['usePolling', 'interval', 'binaryInterval']) {
        expect(options).not.toHaveProperty(alias)
      }
      const { FSWatcher } = await vi.importActual<typeof import('chokidar')>('chokidar')
      const actual = new FSWatcher(options)
      try {
        expect(actual.options).toMatchObject(expected)
      }
      finally {
        await actual.close()
      }
    }
    finally {
      await close()
    }
  })
})

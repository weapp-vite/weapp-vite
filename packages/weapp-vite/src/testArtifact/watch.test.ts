import path from 'node:path'
import chokidar from 'chokidar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  contents: new Map<string, string>(),
  dependencies: [] as string[],
  inlineConfig: {} as Record<string, unknown>,
  handlers: new Map<string, (...args: unknown[]) => void>(),
  readyFailure: undefined as Error | undefined,
  build: vi.fn(async () => undefined),
  add: vi.fn(),
  close: vi.fn(async () => undefined),
}))

vi.mock('./inputs', async (importOriginal) => {
  const original = await importOriginal<typeof import('./inputs')>()
  return {
    ...original,
    fingerprintPaths: vi.fn(async (paths: Iterable<string>) => JSON.stringify(
      [...new Set(paths)].sort().map(file => [file, state.contents.get(file) ?? null]),
    )),
  }
})

vi.mock('../runtime/compilerSession', () => ({
  CompilerSession: class {
    async initialize(options: { cwd: string, outputRoot: string }) {
      return {
        buildService: { build: state.build },
        configService: {
          absoluteSrcRoot: path.join(options.cwd, 'src'),
          configFileDependencies: [...state.dependencies],
          inlineConfig: state.inlineConfig,
          outDir: options.outputRoot,
        },
      }
    }

    async close() {}

    run(task: () => Promise<unknown>) {
      return task()
    }
  },
}))

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      add: state.add,
      close: state.close,
      unwatch: vi.fn(async () => undefined),
      once(event: string, callback: (error?: unknown) => void) {
        if (event === 'error' && state.readyFailure) {
          queueMicrotask(() => callback(state.readyFailure))
        }
        else if (event === 'ready' && !state.readyFailure) {
          queueMicrotask(callback)
        }
        return this
      },
      off: vi.fn(),
      on(event: string, callback: (...args: unknown[]) => void) {
        state.handlers.set(event, callback)
        return this
      },
    })),
  },
}))

const cwd = path.resolve('artifact-fixture')
const source = path.join(cwd, 'src')
const watchers: Array<{ close: () => Promise<void> }> = []

beforeEach(() => {
  vi.useFakeTimers()
  state.contents.clear()
  state.contents.set(source, 'one')
  state.dependencies = []
  state.inlineConfig = {}
  state.handlers.clear()
  state.readyFailure = undefined
  state.build.mockReset().mockResolvedValue(undefined)
  state.add.mockClear()
  state.close.mockReset().mockResolvedValue(undefined)
  vi.mocked(chokidar.watch).mockClear()
  vi.stubEnv('CHOKIDAR_USEPOLLING', undefined)
  vi.stubEnv('CHOKIDAR_INTERVAL', undefined)
  vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', undefined)
})

afterEach(async () => {
  await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function emit(event = 'change', file = source) {
  state.handlers.get(event)!(file)
  await vi.advanceTimersByTimeAsync(20)
}

describe('test artifact watch invalidation', () => {
  it.each([
    { label: 'unconfigured backend', config: {}, expected: {} },
    {
      label: 'build native backend over server polling',
      config: {
        build: { watch: { chokidar: { backend: 'native' } } },
        server: { watch: { backend: 'polling' } },
      },
      expected: { backend: 'native' },
    },
    {
      label: 'explicit automatic backend',
      config: { build: { watch: { chokidar: { backend: 'auto', usePolling: true } } } },
      expected: { backend: 'auto' },
    },
    {
      label: 'legacy server native backend',
      config: { server: { watch: { usePolling: false } } },
      expected: { backend: 'native' },
    },
    {
      label: 'canonical polling intervals',
      config: { build: { watch: { chokidar: { backend: 'polling', pollingInterval: 25, pollingBinaryInterval: 50 } } } },
      expected: { backend: 'polling', pollingInterval: 25, pollingBinaryInterval: 50 },
    },
    {
      label: 'legacy polling intervals',
      config: { server: { watch: { usePolling: true, interval: 30, binaryInterval: 60 } } },
      expected: { backend: 'polling', pollingInterval: 30, pollingBinaryInterval: 60 },
    },
  ])('inherits $label from the initialized compiler configuration', async ({ config, expected }) => {
    state.inlineConfig = config
    const { watchTestArtifact } = await import('../testArtifact')
    const watcher = await watchTestArtifact({ cwd })
    watchers.push(watcher)

    expect(chokidar.watch).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      ...expected,
      ignoreInitial: true,
      ignored: expect.any(Function),
    }))
  })

  it('retains a plain startup snapshot when later compiler work changes its configuration', async () => {
    const config = { build: { watch: { chokidar: { backend: 'native' } } } }
    state.inlineConfig = config
    state.build.mockImplementationOnce(async () => {
      config.build.watch.chokidar.backend = 'polling'
    })
    const { watchTestArtifact } = await import('../testArtifact')
    const watcher = await watchTestArtifact({ cwd })
    watchers.push(watcher)

    expect(chokidar.watch).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ backend: 'native' }))
  })

  it('captures polling options before later compiler work changes them', async () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', 'true')
    vi.stubEnv('CHOKIDAR_INTERVAL', '25')
    vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', '50')
    state.build.mockImplementationOnce(async () => {
      vi.stubEnv('CHOKIDAR_USEPOLLING', 'false')
      vi.stubEnv('CHOKIDAR_INTERVAL', '100')
      vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', '200')
    })
    const { watchTestArtifact } = await import('../testArtifact')
    const watcher = await watchTestArtifact({ cwd })
    watchers.push(watcher)

    expect(chokidar.watch).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      backend: 'polling',
      pollingInterval: 25,
      pollingBinaryInterval: 50,
    }))
  })

  it.each([false, true])('preserves the initial readiness failure when backend cleanup fails: %s', async (cleanupFails) => {
    const initialFailure = new Error('watch readiness failed')
    const closeFailure = new Error(initialFailure.message)
    state.readyFailure = initialFailure
    if (cleanupFails) {
      state.close.mockRejectedValueOnce(closeFailure)
    }
    const { watchTestArtifact } = await import('../testArtifact')
    const failure = await watchTestArtifact({ cwd }).catch(error => error)

    if (cleanupFails) {
      expect(failure).toBeInstanceOf(AggregateError)
      const leafErrors = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
      const leaves = leafErrors(failure)
      expect(leaves).toHaveLength(2)
      expect(leaves[0]).toBe(initialFailure)
      expect(leaves[1]).toBe(closeFailure)
      expect(failure.cause).toBe(initialFailure)
    }
    else {
      expect(failure).toBe(initialFailure)
    }
    expect(state.close).toHaveBeenCalledOnce()
  })

  it.each(['complete', 'fail'] as const)('drains an active artifact build after backend close fails and the build will %s', async (outcome) => {
    const { watchTestArtifact } = await import('../testArtifact')
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd, onRebuilt })
    const buildFailure = new Error('artifact build failed')
    const closeFailure = new Error('watch close failed')
    const buildStarted = Promise.withResolvers<void>()
    const build = Promise.withResolvers<void>()
    const closeStarted = Promise.withResolvers<void>()
    state.build.mockImplementationOnce(() => {
      buildStarted.resolve()
      return build.promise
    })
    const rebuilding = watcher.rebuild().catch(error => error)
    await buildStarted.promise
    state.close.mockImplementationOnce(async () => {
      closeStarted.resolve()
      throw closeFailure
    })
    const closing = watcher.close()
    let settled = false
    const result = closing.catch((error: unknown) => {
      settled = true
      return error
    })
    await closeStarted.promise
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    expect(watcher.close()).toBe(closing)
    if (outcome === 'fail') {
      build.reject(buildFailure)
    }
    else {
      build.resolve()
    }
    const failure = await result
    await rebuilding
    if (outcome === 'fail') {
      expect(failure).toBeInstanceOf(AggregateError)
      expect((failure as AggregateError).errors).toEqual([closeFailure, buildFailure])
    }
    else {
      expect(failure).toBe(closeFailure)
    }
    expect(onRebuilt).not.toHaveBeenCalled()
    expect(state.close).toHaveBeenCalledOnce()
  })

  it('ignores late duplicate notifications after publishing the same inputs', async () => {
    const { watchTestArtifact } = await import('../testArtifact')
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd, onRebuilt })
    watchers.push(watcher)

    state.contents.set(source, 'two')
    await emit()
    const published = watcher.artifact
    expect(state.build).toHaveBeenCalledTimes(2)

    await emit()
    expect(state.build).toHaveBeenCalledTimes(2)
    expect(onRebuilt).toHaveBeenCalledTimes(1)
    expect(watcher.artifact).toBe(published)
  })

  it('does not append a generation for duplicate events received during a build', async () => {
    const { watchTestArtifact } = await import('../testArtifact')
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd, onRebuilt })
    watchers.push(watcher)
    let finish!: () => void
    state.build.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve
    }))

    state.contents.set(source, 'two')
    await emit()
    expect(state.build).toHaveBeenCalledTimes(2)
    await emit()
    finish()
    await vi.advanceTimersByTimeAsync(0)

    expect(state.build).toHaveBeenCalledTimes(2)
    expect(onRebuilt).toHaveBeenCalledTimes(1)
  })

  it('rebuilds when a real edit arrives during compilation', async () => {
    const { isTestArtifactCurrent, watchTestArtifact } = await import('../testArtifact')
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd, onRebuilt })
    watchers.push(watcher)
    let finish!: () => void
    state.build.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve
    }))

    state.contents.set(source, 'two')
    await emit()
    state.contents.set(source, 'end')
    await emit()
    finish()
    await vi.advanceTimersByTimeAsync(0)

    expect(state.build).toHaveBeenCalledTimes(3)
    expect(onRebuilt).toHaveBeenCalledTimes(2)
    expect(await isTestArtifactCurrent(watcher.artifact)).toBe(true)
  })

  it('keeps explicit rebuilds forced even when inputs have not changed', async () => {
    const { watchTestArtifact } = await import('../testArtifact')
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd, onRebuilt })
    watchers.push(watcher)
    const initial = watcher.artifact

    await watcher.rebuild()
    expect(state.build).toHaveBeenCalledTimes(2)
    expect(onRebuilt).toHaveBeenCalledTimes(1)
    expect(watcher.artifact).not.toBe(initial)
  })

  it('retries an unchanged input after a failed build', async () => {
    const { watchTestArtifact } = await import('../testArtifact')
    const onError = vi.fn()
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd, onError, onRebuilt })
    watchers.push(watcher)
    state.build.mockRejectedValueOnce(new Error('compiler failed'))

    state.contents.set(source, 'two')
    await emit()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'compiler failed' }))
    expect(onRebuilt).not.toHaveBeenCalled()
    await emit()

    expect(state.build).toHaveBeenCalledTimes(3)
    expect(onRebuilt).toHaveBeenCalledTimes(1)
  })

  it('tracks newly discovered dependencies and their subsequent content changes', async () => {
    const { watchTestArtifact } = await import('../testArtifact')
    const watcher = await watchTestArtifact({ cwd })
    watchers.push(watcher)
    const dependency = path.resolve('external-fixture/config.ts')
    state.dependencies = [dependency]
    state.contents.set(dependency, 'one')
    state.contents.set(source, 'two')
    await emit('add')
    expect(chokidar.watch).toHaveBeenLastCalledWith(expect.arrayContaining([dependency]), expect.any(Object))

    state.contents.set(dependency, 'two')
    await emit('change', dependency)
    await emit('change', dependency)
    expect(state.build).toHaveBeenCalledTimes(3)
  })
})

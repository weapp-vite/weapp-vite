import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  contents: new Map<string, string>(),
  dependencies: [] as string[],
  handlers: new Map<string, () => void>(),
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
      once(event: string, callback: () => void) {
        if (event === 'ready') {
          callback()
        }
        return this
      },
      on(event: string, callback: () => void) {
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
  state.handlers.clear()
  state.build.mockReset().mockResolvedValue(undefined)
  state.add.mockClear()
  state.close.mockClear()
})

afterEach(async () => {
  await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
  vi.useRealTimers()
})

async function emit(event = 'change') {
  state.handlers.get(event)!()
  await vi.advanceTimersByTimeAsync(20)
}

describe('test artifact watch invalidation', () => {
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
    expect(state.add).toHaveBeenLastCalledWith(expect.arrayContaining([dependency]))

    state.contents.set(dependency, 'two')
    await emit()
    await emit()
    expect(state.build).toHaveBeenCalledTimes(3)
  })
})

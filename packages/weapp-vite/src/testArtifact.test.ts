import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const buildMock = vi.hoisted(() => vi.fn(async () => ({ output: [] })))
const closeSessionMock = vi.hoisted(() => vi.fn(async () => undefined))
const createCompilerContextMock = vi.hoisted(() => vi.fn(async (options: any) => ({
  buildService: { build: buildMock },
  configService: {
    absoluteSrcRoot: '/project/src',
    outDir: options.inlineConfig.build.outDir,
  },
})))
const watcherMock = vi.hoisted(() => {
  const handlers = new Map<string, () => void>()
  const close = vi.fn(async () => undefined)
  const add = vi.fn()
  const unwatch = vi.fn(async () => undefined)
  const watch = vi.fn(() => ({
    close,
    add,
    unwatch,
    once(event: string, handler: () => void) {
      if (event === 'ready') {
        handler()
      }
      return this
    },
    on(event: string, handler: () => void) {
      handlers.set(event, handler)
      return this
    },
  }))
  return { add, close, handlers, watch }
})

vi.mock('./runtime/compilerSession', () => ({
  CompilerSession: class {
    initialize = createCompilerContextMock
    close = closeSessionMock
    run(task: () => Promise<unknown>) {
      return task()
    }
  },
}))
vi.mock('chokidar', () => ({
  default: { watch: watcherMock.watch },
}))

describe('test artifact build API', () => {
  const projectPath = path.resolve('/project')

  beforeEach(() => {
    buildMock.mockReset().mockResolvedValue({ output: [] })
    createCompilerContextMock.mockClear()
    watcherMock.close.mockClear()
    watcherMock.handlers.clear()
    watcherMock.watch.mockClear()
    watcherMock.add.mockClear()
    closeSessionMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds through the compiler service into the isolated test artifact directory', async () => {
    const { buildTestArtifact } = await import('./testArtifact')
    const artifact = await buildTestArtifact({ cwd: '/project', skipNpm: true })
    const testArtifactPath = artifact.miniprogramRootPath
    expect(testArtifactPath.startsWith(path.join(projectPath, '.weapp-vite/test-artifacts'))).toBe(true)

    expect(createCompilerContextMock).toHaveBeenCalledWith(expect.objectContaining({
      cwd: projectPath,
      isDev: false,
      mode: 'test',
      outputRoot: testArtifactPath,
      preloadAppEntry: false,
      syncSupportFiles: false,
      inlineConfig: {
        plugins: [
          expect.objectContaining({ name: 'weapp-vite:watch-dependencies' }),
          expect.objectContaining({ name: 'weapp-vite:test-artifact-inputs' }),
        ],
        build: {
          emptyOutDir: true,
          outDir: testArtifactPath,
        },
      },
    }))
    expect(buildMock).toHaveBeenCalledWith({ skipNpm: true })
    expect(closeSessionMock).toHaveBeenCalledTimes(1)
    expect(artifact).toEqual({
      appConfigPath: path.join(testArtifactPath, 'app.json'),
      miniprogramRootPath: testArtifactPath,
      projectPath,
      sourceRootPath: '/project/src',
    })
  })

  it('rebuilds the complete artifact after watched source changes', async () => {
    vi.useFakeTimers()
    const { watchTestArtifact } = await import('./testArtifact')
    let markRebuilt: (() => void) | undefined
    const rebuilt = new Promise<void>((resolve) => {
      markRebuilt = resolve
    })
    const onRebuilt = vi.fn(() => markRebuilt?.())
    const watcher = await watchTestArtifact({
      cwd: '/project',
      onRebuilt,
      skipNpm: true,
    })

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(watcherMock.watch).toHaveBeenCalledWith(expect.arrayContaining(['/project/src', path.join(projectPath, 'vite.config.ts')]), {
      ignoreInitial: true,
      ignored: expect.any(Function),
    })

    watcherMock.handlers.get('change')?.()
    await vi.advanceTimersByTimeAsync(20)
    await rebuilt
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(onRebuilt).toHaveBeenCalledWith(watcher.artifact)

    await watcher.close()
    expect(watcherMock.close).toHaveBeenCalledTimes(1)
  })

  it('waits for an active build on close and suppresses late notifications', async () => {
    const { watchTestArtifact } = await import('./testArtifact')
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd: '/project', onRebuilt })
    let finish!: () => void
    const started = new Promise<void>((resolve) => {
      buildMock.mockImplementationOnce(async () => {
        resolve()
        await new Promise<void>((resolveBuild) => {
          finish = resolveBuild
        })
        return { output: [] }
      })
    })
    const rebuilding = watcher.rebuild()
    await started
    let finished = false
    const closing = watcher.close().then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    finish()
    await Promise.all([rebuilding, closing, watcher.close()])
    expect(onRebuilt).not.toHaveBeenCalled()
    expect(watcherMock.close).toHaveBeenCalledTimes(1)
    await expect(watcher.rebuild()).rejects.toThrow('already closed')
  })

  it('coalesces edits during a build into one follow-up build', async () => {
    const { watchTestArtifact } = await import('./testArtifact')
    const watcher = await watchTestArtifact({ cwd: '/project' })
    let finish!: () => void
    const started = new Promise<void>((resolve) => {
      buildMock.mockImplementationOnce(async () => {
        resolve()
        await new Promise<void>((resolveBuild) => {
          finish = resolveBuild
        })
        return { output: [] }
      })
    })
    const rebuilding = watcher.rebuild()
    await started
    const second = watcher.rebuild()
    const third = watcher.rebuild()
    finish()
    await Promise.all([rebuilding, second, third])
    expect(buildMock).toHaveBeenCalledTimes(3)
    await watcher.close()
  })

  it('releases its compiler session when the build fails', async () => {
    const { buildTestArtifact } = await import('./testArtifact')
    buildMock.mockRejectedValueOnce(new Error('compiler failed'))
    await expect(buildTestArtifact({ cwd: '/project' })).rejects.toThrow('compiler failed')
    expect(closeSessionMock).toHaveBeenCalledTimes(1)
  })
})

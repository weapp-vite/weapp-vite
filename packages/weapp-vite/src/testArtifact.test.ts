import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const buildMock = vi.hoisted(() => vi.fn(async () => ({ output: [] })))
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
  const watch = vi.fn(() => ({
    close,
    on(event: string, handler: () => void) {
      handlers.set(event, handler)
      return this
    },
  }))
  return { close, handlers, watch }
})

vi.mock('./createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))
vi.mock('chokidar', () => ({
  default: { watch: watcherMock.watch },
}))

describe('test artifact build API', () => {
  const projectPath = path.resolve('/project')
  const testArtifactPath = path.join(projectPath, '.weapp-vite/test-artifacts')

  beforeEach(() => {
    buildMock.mockClear()
    createCompilerContextMock.mockClear()
    watcherMock.close.mockClear()
    watcherMock.handlers.clear()
    watcherMock.watch.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds through the compiler service into the isolated test artifact directory', async () => {
    const { buildTestArtifact } = await import('./testArtifact')
    const artifact = await buildTestArtifact({ cwd: '/project', skipNpm: true })

    expect(createCompilerContextMock).toHaveBeenCalledWith(expect.objectContaining({
      cwd: projectPath,
      isDev: false,
      mode: 'test',
      outputRoot: testArtifactPath,
      preloadAppEntry: false,
      syncSupportFiles: false,
      inlineConfig: {
        build: {
          emptyOutDir: true,
          outDir: testArtifactPath,
        },
      },
    }))
    expect(buildMock).toHaveBeenCalledWith({ skipNpm: true })
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
    expect(watcherMock.watch).toHaveBeenCalledWith('/project/src', {
      ignoreInitial: true,
      ignored: [testArtifactPath],
    })

    watcherMock.handlers.get('change')?.()
    await vi.advanceTimersByTimeAsync(20)
    await rebuilt
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(onRebuilt).toHaveBeenCalledWith(watcher.artifact)

    await watcher.close()
    expect(watcherMock.close).toHaveBeenCalledTimes(1)
  })
})

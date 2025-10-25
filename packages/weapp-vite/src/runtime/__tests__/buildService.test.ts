import type { OutputAsset, OutputChunk, RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../logger'
import { createBuildServicePlugin } from '../buildPlugin'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin } from '../watcherPlugin'

type WatcherEvent = 'change' | 'event' | 'restart' | 'close'
type Listener = (...args: any[]) => Promise<void> | void

class MockWatcher implements RolldownWatcher {
  listeners = new Map<WatcherEvent, Listener[]>()
  timer: any

  on(event: WatcherEvent, listener: Listener) {
    const bucket = this.listeners.get(event) ?? []
    bucket.push(listener)
    this.listeners.set(event, bucket)
    return this
  }

  off(event: WatcherEvent, listener: Listener) {
    const bucket = this.listeners.get(event)
    if (!bucket) {
      return this
    }
    this.listeners.set(event, bucket.filter(entry => entry !== listener))
    return this
  }

  clear(event: WatcherEvent) {
    this.listeners.delete(event)
  }

  async onEvent(event: { eventKind: () => string }) {
    const kind = event.eventKind()
    if (kind === 'close') {
      await this.emit('close')
    }
  }

  async emit(event: WatcherEvent, payload?: any) {
    const bucket = this.listeners.get(event) ?? []
    for (const listener of bucket) {
      await listener(payload)
    }
  }

  async close() {
    await this.emit('close')
  }

  get watchFiles() {
    return Promise.resolve<string[]>([])
  }
}

function createMockCompilerContext() {
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
  } as MutableCompilerContext

  ctx.configService = {
    weappViteConfig: {},
    merge: vi.fn(),
    mergeWorkers: vi.fn(),
    relativeAbsoluteSrcRoot: (p: string) => p,
    absoluteSrcRoot: '/project/src',
    relativeCwd: (p: string) => p,
    outDir: '/project/dist',
    mpDistRoot: '',
    isDev: true,
  } as unknown as MutableCompilerContext['configService']

  createWatcherServicePlugin(ctx)

  ctx.npmService = {
    build: vi.fn(),
    checkDependenciesCacheOutdate: vi.fn().mockResolvedValue(true),
  } as unknown as MutableCompilerContext['npmService']

  ctx.scanService = {
    workersDir: undefined,
  } as unknown as MutableCompilerContext['scanService']

  createBuildServicePlugin(ctx)
  return ctx
}

describe('buildService independent outputs', () => {
  const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

  beforeEach(() => {
    loggerErrorSpy.mockClear()
  })

  it('resolves waiters when outputs are stored', async () => {
    const ctx = createMockCompilerContext()
    const buildService = ctx.buildService!
    const version = buildService.getIndependentVersion('pkg')
    expect(version).toBe(0)

    const waitPromise = buildService.waitForIndependentOutput('pkg', version)
    const chunk: OutputChunk = {
      type: 'chunk',
      code: 'console.log(1)',
      name: 'index',
      isEntry: true,
      exports: [],
      fileName: 'pkg/index.js',
      modules: {} as OutputChunk['modules'],
      imports: [],
      dynamicImports: [],
      facadeModuleId: null,
      isDynamicEntry: false,
      moduleIds: [],
      map: null,
      sourcemapFileName: null,
      preliminaryFileName: 'pkg/index.js',
    }
    const output = {
      output: [chunk] as [OutputChunk, ...(OutputChunk | OutputAsset)[]],
    }

    buildService.storeIndependentOutput('pkg', output)
    await expect(waitPromise).resolves.toBe(output)
    expect(buildService.getIndependentVersion('pkg')).toBe(1)
  })

  it('registers watcher and resolves on bundle end', async () => {
    const ctx = createMockCompilerContext()
    const buildService = ctx.buildService!
    const watcher = new MockWatcher()
    buildService.registerIndependentWatcher('pkg', watcher)

    const waitPromise = buildService.waitForIndependentOutput('pkg', 0)
    const bindingOutputs = {
      chunks: [
        {
          code: 'console.log(2)',
          name: 'page',
          isEntry: true,
          exports: [],
          fileName: 'pkg/page.js',
          imports: [],
          dynamicImports: [],
          facadeModuleId: null,
          isDynamicEntry: false,
          moduleIds: [],
          map: null,
          sourcemapFileName: null,
          preliminaryFileName: 'pkg/page.js',
          modules: { keys: [], values: [] },
        },
      ],
      assets: [],
    }

    await watcher.emit('event', {
      code: 'BUNDLE_END',
      duration: 1,
      output: [],
      result: {
        generate: vi.fn().mockResolvedValue(bindingOutputs),
      },
    })

    const rollup = await waitPromise
    expect(rollup.output[0]?.fileName).toBe('pkg/page.js')
    expect(buildService.getIndependentVersion('pkg')).toBe(1)
  })
})

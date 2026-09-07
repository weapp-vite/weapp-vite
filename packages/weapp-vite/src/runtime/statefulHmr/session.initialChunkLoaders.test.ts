import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { StatefulHmrOutputFile } from './outputWriter'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createScanService } from '../scanPlugin/service'
import { runStatefulHmrDev } from './session'

interface AdapterCallbacks {
  onOutput: (output: StatefulHmrOutputFile[]) => void
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as AdapterCallbacks | undefined,
  output: [] as StatefulHmrOutputFile[],
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[]) => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))

vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))

vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: AdapterCallbacks) {
      harness.callbacks = callbacks
    }

    install() {}
    async registerBundleModules() { return 1 }
  },
}))

vi.mock('../../utils', async importOriginal => ({
  ...await importOriginal<typeof import('../../utils')>(),
  findJsonEntry: async (base: string) => ({ path: base.endsWith('/app') ? `${base}.json` : undefined }),
  findJsEntry: async (base: string) => ({ path: base.endsWith('/app') ? `${base}.ts` : undefined }),
  findVueEntry: async () => undefined,
}))

function chunk(fileName: string, id: string): Extract<StatefulHmrOutputFile, { type: 'chunk' }> {
  return {
    type: 'chunk',
    fileName,
    isEntry: false,
    modules: {},
    imports: [],
    code: `__rolldown_runtime__.registerModule(${JSON.stringify(id)}, { exports: {} });`,
  }
}

describe('stateful session initial chunk package boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    harness.callbacks = undefined
    harness.writeOutput.mockResolvedValue()
    harness.createServer.mockImplementation(async (options: InlineConfig) => {
      const server = {
        config: { root: options.root, server: {}, logger: { info: vi.fn(), error: vi.fn() } },
        middlewares: { use: vi.fn() },
        httpServer: { address: () => undefined },
        close: vi.fn(),
        async listen() {
          harness.callbacks!.onOutput(harness.output)
          await harness.callbacks!.waitForInitialBundle()
        },
      }
      const plugin = options.plugins?.find(value => value && 'name' in value && value.name === 'weapp-vite:stateful-hmr-session') as Plugin
      const configure = plugin.configureServer as (server: unknown) => void
      configure(server)
      return server
    })
  })

  it.each(['app config', 'auto routes'])('excludes subpackages discovered from %s without requiring config overrides', async (source) => {
    const root = path.join(tmpdir(), 'stateful-session-package-boundaries')
    const declaredPackages = [{ root: 'feature', pages: ['pages/index'] }]
    const independentPackage = { root: 'independent', independent: true, pages: ['pages/index'] }
    const appConfig = {
      pages: ['pages/index'],
      subPackages: [...(source === 'app config' ? declaredPackages : []), independentPackage],
    }
    const ctx = {
      runtimeState: createRuntimeState(),
      configService: {
        platform: 'weapp',
        cwd: root,
        absoluteSrcRoot: path.join(root, 'src'),
        outDir: path.join(root, 'dist'),
        weappViteConfig: {},
      },
      jsonService: { read: vi.fn(async () => appConfig) },
      autoRoutesService: {
        isEnabled: () => source === 'auto routes',
        ensureFresh: vi.fn(async () => {}),
        getReference: () => ({ pages: ['pages/index'], entries: [], subPackages: declaredPackages }),
      },
    } as unknown as MutableCompilerContext
    ctx.scanService = createScanService(ctx)
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    expect([...ctx.scanService.subPackageMap.keys()].sort()).toEqual(['feature', 'independent'])
    expect(ctx.configService!.weappViteConfig.subPackages).toBeUndefined()

    harness.output = [
      { ...chunk('app.js', 'app'), isEntry: true },
      {
        ...chunk('rolldown-runtime.js', 'runtime'),
        code: 'globalThis.__rolldown_runtime__ = { initialChunkLoaders: new Map() };',
      },
      chunk('vendor/main.js', 'main-shared'),
      chunk('feature/vendor.js', 'feature-shared'),
      chunk('independent/vendor.js', 'independent-shared'),
    ]
    const watcher = await runStatefulHmrDev(ctx, { root }, vi.fn(async () => {}), {
      initial: [],
      entryIds: [],
      rebuild: vi.fn(async () => []),
    })
    try {
      const files = harness.writeOutput.mock.calls.flatMap(([, output]) => output)
      const runtime = files.find(file => file.type === 'chunk' && file.fileName === 'rolldown-runtime.js')
      expect(runtime?.type).toBe('chunk')
      if (!runtime || runtime.type !== 'chunk') {
        throw new Error('Missing captured session runtime output')
      }
      const require = vi.fn()
      const nativePage = vi.fn()
      const state = runInNewContext(`${runtime.code}\nglobalThis.__rolldown_runtime__`, { require, Page: nativePage }) as {
        initialChunkLoaders: Map<string, unknown>
      }
      expect([...state.initialChunkLoaders.keys()]).toEqual(['main-shared'])
      expect(require).not.toHaveBeenCalled()
      expect(nativePage).not.toHaveBeenCalled()
    }
    finally {
      await watcher.close()
    }
  })
})

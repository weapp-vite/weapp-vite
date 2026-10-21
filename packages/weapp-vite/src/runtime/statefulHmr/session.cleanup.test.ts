import type { MutableCompilerContext } from '../../context'
import type { HmrDeliveryCoordinator } from './deliveryCoordinator'
import type { StatefulHmrTransport } from './transport'
import type { StatefulHmrViteAdapter } from './viteAdapter'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMockViteWatcher } from '../../../test/helpers/viteWatcher'
import { logger } from '../../context/shared'
import { getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { runStatefulHmrDev } from './session'

const harness = vi.hoisted(() => ({
  createServer: vi.fn(),
  closeAssets: vi.fn(),
  closeAdapter: vi.fn(),
  closeProfile: vi.fn(),
  beginProfile: vi.fn(),
  listen: vi.fn(),
  closeServer: vi.fn(),
  restore: vi.fn(),
  delivery: undefined as HmrDeliveryCoordinator | undefined,
  transport: undefined as StatefulHmrTransport | undefined,
  callbacks: undefined as ConstructorParameters<typeof StatefulHmrViteAdapter>[2] | undefined,
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: async () => {} }))
vi.mock('./assetWatch', () => ({ installIdeAssetWatch: async () => harness.restore }))
vi.mock('./profile', () => ({ createStatefulHmrProfile: () => ({ close: harness.closeProfile, begin: harness.beginProfile }) }))
vi.mock('./deliveryCoordinator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./deliveryCoordinator')>()
  return {
    ...actual,
    HmrDeliveryCoordinator: class extends actual.HmrDeliveryCoordinator {
      constructor(...args: ConstructorParameters<typeof actual.HmrDeliveryCoordinator>) {
        super(...args)
        harness.delivery = this
      }
    },
  }
})
vi.mock('./transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transport')>()
  return {
    ...actual,
    StatefulHmrTransport: class extends actual.StatefulHmrTransport {
      constructor(...args: ConstructorParameters<typeof actual.StatefulHmrTransport>) {
        super(...args)
        harness.transport = this
      }
    },
  }
})
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: ConstructorParameters<typeof StatefulHmrViteAdapter>[2]) {
      harness.callbacks = callbacks
    }

    install() {}
    close() { return harness.closeAdapter() }
  },
}))
vi.mock('../watch/assets', () => ({
  watchAssetSources: () => ({ ready: Promise.resolve(), close: harness.closeAssets }),
}))

let root: string

beforeEach(async () => {
  vi.resetAllMocks()
  harness.delivery = undefined
  harness.transport = undefined
  harness.callbacks = undefined
  root = await fs.mkdtemp(path.join(tmpdir(), 'stateful-cleanup-'))
  harness.createServer.mockImplementation(async (inlineConfig = {}) => ({
    config: { inlineConfig, root, publicDir: false, build: {}, server: {}, logger: { error: vi.fn() } },
    watcher: createMockViteWatcher(),
    middlewares: { use: vi.fn() },
    httpServer: { address: () => undefined },
    listen: harness.listen,
    restart: vi.fn(async () => {}),
    close: harness.closeServer,
  }))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.remove(root)
})

function createContext() {
  return {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      projectPrivateConfigPath: path.join(root, 'project.private.config.json'),
      multiPlatform: { enabled: false },
      weappViteConfig: {},
    },
  } as unknown as MutableCompilerContext
}

it.each(['none', 'session', 'server', 'both'] as const)('retains startup and independent cleanup failures without duplication: %s', async (failureSource) => {
  const startupFailure = new Error('server listen failed')
  const adapterFailure = new Error('adapter cleanup failed')
  const serverFailure = new Error('server cleanup failed')
  const failSession = failureSource === 'session' || failureSource === 'both'
  const failServer = failureSource === 'server' || failureSource === 'both'
  harness.listen.mockRejectedValueOnce(startupFailure)
  if (failSession) {
    harness.closeAdapter.mockRejectedValueOnce(adapterFailure)
  }
  if (failServer) {
    harness.closeServer.mockRejectedValueOnce(serverFailure)
  }
  const ctx = createContext()
  const failure = await runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher()).catch((error: unknown) => error)
  if (failureSource === 'none') {
    expect(failure).toBe(startupFailure)
  }
  else {
    const cleanupFailure = failSession && failServer ? expect.any(AggregateError) : failSession ? adapterFailure : serverFailure
    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure).toMatchObject({ cause: startupFailure, errors: [startupFailure, cleanupFailure] })
    if (failSession && failServer) {
      expect((failure as AggregateError).errors[1]).toMatchObject({ errors: [adapterFailure, serverFailure] })
    }
  }
  expect(harness.closeAdapter).toHaveBeenCalledOnce()
  expect(harness.closeServer).toHaveBeenCalledOnce()
  expect(harness.closeProfile).toHaveBeenCalledOnce()
  expect(harness.closeProfile).toHaveBeenCalledWith('failed')
  expect(harness.restore).toHaveBeenCalledOnce()
  expect(harness.closeAssets).not.toHaveBeenCalled()
  expect(ctx.onStatefulHmrSourceChange).toBeUndefined()
})

it.each([false, true])('continues ordered cleanup after resource failures and retains lease restoration failure: %s', async (failRestore) => {
  const events: string[] = []
  const assetFailure = new Error('asset watcher close failed')
  const adapterFailure = new Error('native adapter close failed')
  const restoreFailure = new Error('IDE lease restore failed')
  harness.closeAssets.mockImplementation(() => {
    events.push('assets')
    throw assetFailure
  })
  harness.closeAdapter.mockImplementation(async () => {
    events.push('adapter')
    throw adapterFailure
  })
  harness.closeProfile.mockImplementation(async () => {
    events.push('profile')
  })
  harness.restore.mockImplementation(async () => {
    events.push('restore')
    if (failRestore) {
      throw restoreFailure
    }
  })
  const ctx = createContext()
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher())
  const errors = [assetFailure, adapterFailure, ...(failRestore ? [restoreFailure] : [])]
  await expect(watcher.close()).rejects.toMatchObject({ errors, cause: assetFailure })
  await expect(watcher.close()).rejects.toMatchObject({ errors, cause: assetFailure })
  expect(events).toEqual(['assets', 'adapter', 'profile', 'restore'])
  expect(harness.closeServer).toHaveBeenCalledOnce()
  expect(ctx.onStatefulHmrSourceChange).toBeUndefined()
})

it.each(['session', 'server', 'both'] as const)('retains standalone close failures and shares one pending cleanup: %s', async (failureSource) => {
  const sessionFailure = new Error('session adapter cleanup failed')
  const serverFailure = new Error('native server cleanup failed')
  const failSession = failureSource !== 'server'
  const failServer = failureSource !== 'session'
  const serverClosing = Promise.withResolvers<void>()
  const serverClosed = Promise.withResolvers<void>()
  if (failSession) {
    harness.closeAdapter.mockRejectedValueOnce(sessionFailure)
  }
  harness.closeServer.mockImplementation(async () => {
    serverClosing.resolve()
    await serverClosed.promise
    if (failServer) {
      throw serverFailure
    }
  })
  const ctx = createContext()
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher())
  const closing = watcher.close()
  const settled = vi.fn()
  const outcome = closing.then(settled, (error: unknown) => {
    settled()
    return error
  })
  let failure: unknown
  try {
    expect(watcher.close()).toBe(closing)
    await serverClosing.promise
    expect(settled).not.toHaveBeenCalled()
    expect(harness.closeAdapter).toHaveBeenCalledOnce()
    expect(harness.restore).toHaveBeenCalledOnce()
  }
  finally {
    serverClosed.resolve()
    failure = await outcome
  }
  const errors = [...(failSession ? [sessionFailure] : []), ...(failServer ? [serverFailure] : [])]
  if (errors.length === 1) {
    expect(failure).toBe(errors[0])
  }
  else {
    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure).toMatchObject({ errors })
  }
  expect(watcher.close()).toBe(closing)
  expect(harness.closeAdapter).toHaveBeenCalledOnce()
  expect(harness.closeServer).toHaveBeenCalledOnce()
  expect(harness.closeAssets).toHaveBeenCalledOnce()
  expect(harness.closeProfile).toHaveBeenCalledOnce()
  expect(harness.restore).toHaveBeenCalledOnce()
  expect(ctx.onStatefulHmrSourceChange).toBeUndefined()
})

it('retires an unacknowledged delivery before transport shutdown and waits for its disposal once', async () => {
  const buildEvents = createDevBuildWatcher()
  const emitEvent = vi.spyOn(buildEvents, 'emitEvent')
  const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => {})
  const watcher = await runStatefulHmrDev(createContext(), { root }, async () => {}, {
    entryIds: [],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, buildEvents)
  const publishing = Promise.withResolvers<void>()
  const disposing = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  const dispose = vi.fn(async () => {
    disposing.resolve()
    await disposed.promise
  })
  harness.delivery!.enqueue({
    prepare: async () => ({
      commit: async () => {},
      publish: () => {
        const delivery = harness.transport!.addDelta('void 0', [])
        publishing.resolve()
        return delivery
      },
      dispose,
    }),
  })
  await publishing.promise

  const closing = watcher.close()
  expect(watcher.close()).toBe(closing)
  let closed = false
  void closing.then(() => {
    closed = true
  })
  try {
    await disposing.promise
    expect(closed).toBe(false)
    expect(harness.closeAdapter).not.toHaveBeenCalled()
    expect(harness.restore).not.toHaveBeenCalled()
  }
  finally {
    disposed.resolve()
    await closing
  }
  expect(dispose).toHaveBeenCalledOnce()
  expect(harness.closeAdapter).toHaveBeenCalledOnce()
  expect(harness.closeServer).toHaveBeenCalledOnce()
  expect(harness.restore).toHaveBeenCalledOnce()
  expect(emitEvent.mock.calls.flatMap(([event]) => event.code === 'ERROR' ? [event.error] : [])).toEqual([])
  expect(errorLog).not.toHaveBeenCalled()
})

it.each(['batch', 'patch'] as const)('does not capture or prepare a late %s while an asset watcher is closing', async (kind) => {
  const assetsClosing = Promise.withResolvers<void>()
  const assetsClosed = Promise.withResolvers<void>()
  harness.closeAssets.mockImplementation(async () => {
    assetsClosing.resolve()
    await assetsClosed.promise
  })
  const ctx = createContext()
  const source = path.join(root, 'src/page.js')
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [source],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher())
  const compiler = getCompilerHmrHost(ctx)
  const prepareProvider = vi.fn(() => ({ dispose: vi.fn() }))
  compiler.register('cleanup-probe', prepareProvider)
  const freeze = vi.spyOn(compiler, 'freeze')
  const prepare = vi.spyOn(compiler, 'prepare')
  const addDelta = vi.spyOn(harness.transport!, 'addDelta')
  const closing = watcher.close()
  try {
    await assetsClosing.promise
    const update = { type: 'Patch' as const, code: 'void 0', filename: 'update.js' }
    if (kind === 'batch') {
      harness.callbacks!.onBatch!({ changedFiles: [source], updates: [{ clientId: 'weapp-vite-stateful-hmr', update }] })
    }
    else {
      harness.callbacks!.onPatch([source], update)
    }
    expect(freeze).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
    expect(prepareProvider).not.toHaveBeenCalled()
    expect(harness.beginProfile).not.toHaveBeenCalled()
    expect(addDelta).not.toHaveBeenCalled()
  }
  finally {
    assetsClosed.resolve()
    await closing
  }
})

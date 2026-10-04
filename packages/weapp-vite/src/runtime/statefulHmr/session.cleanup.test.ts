import type { MutableCompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { runStatefulHmrDev } from './session'

const harness = vi.hoisted(() => ({
  createServer: vi.fn(),
  closeAssets: vi.fn(),
  closeAdapter: vi.fn(),
  closeProfile: vi.fn(),
  closeServer: vi.fn(),
  restore: vi.fn(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: async () => {} }))
vi.mock('./assetWatch', () => ({ installIdeAssetWatch: async () => harness.restore }))
vi.mock('./profile', () => ({ createStatefulHmrProfile: () => ({ close: harness.closeProfile }) }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
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
  root = await fs.mkdtemp(path.join(tmpdir(), 'stateful-cleanup-'))
  harness.createServer.mockImplementation(async (inlineConfig = {}) => ({
    config: { inlineConfig, root, publicDir: false, build: {}, server: {}, logger: { error: vi.fn() } },
    watcher: Object.assign(new EventEmitter(), { add: vi.fn() }),
    middlewares: { use: vi.fn() },
    httpServer: { address: () => undefined },
    listen: vi.fn(async () => {}),
    restart: vi.fn(async () => {}),
    close: harness.closeServer,
  }))
})

afterEach(async () => {
  await fs.remove(root)
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
  const ctx = {
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

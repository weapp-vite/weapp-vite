import assert from 'node:assert/strict'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pollingHostHandoff } from './probe/polling.mjs'

interface PollingHandle {
  path: string
  acquiredSequence: number
  stoppedSequence?: number
  stopEvents: number
}

const harness = vi.hoisted(() => ({
  createServer: vi.fn(),
  initializationError: new Error('stop before acquiring a host watcher'),
  files: new Map<string, string>(),
  handles: [] as PollingHandle[],
  sequence: 0,
  failure: '',
  staleFile: '',
  restarts: [] as boolean[],
  close: vi.fn(),
}))

const root = path.resolve('fixture')
const outDir = path.join(root, '.weapp-vite/delivery-host')

vi.mock('vite', () => ({ createServer: harness.createServer }))
vi.mock('weapp-vite/vite', () => ({ weapp: () => ({ name: 'mock:weapp' }) }))
vi.mock('./probe/fixture.mjs', () => ({ weappOptions: {} }))
vi.mock('./probe/public.mjs', () => ({
  assertOutput: vi.fn(async (owner, file, expected) => {
    assert.equal(harness.files.get(path.join(owner.outDir, file)), expected)
  }),
  closeOwner: vi.fn(async (owner) => {
    await owner.close()
    await owner.close()
  }),
}))
vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  readFile: vi.fn(async (file: string) => {
    if (harness.files.has(file)) {
      return harness.files.get(file)
    }
    throw Object.assign(new Error('missing fixture file'), { code: 'ENOENT' })
  }),
  writeFile: vi.fn(async (file: string, content: string) => {
    harness.files.set(file, content)
    const relative = path.relative(path.join(root, 'src'), file)
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      harness.files.set(path.join(outDir, relative), content)
    }
  }),
}))

const privateFile = path.join(root, 'project.private.config.json')
const classicLease = path.join(root, '.weapp-vite/ide-classic-project.private.config.json')
const originalConfig = '{"setting":{"compileHotReLoad":true}}'
const fallback = '[weapp-vite] HMR fallback {"from":"stateful-experimental","to":"classic","reason":"ide-classic-handoff","message":"startup host capability","requested":"stateful-experimental","actual":"classic","phase":"switching"}\n'
const ready = '[weapp-vite] HMR classic ready {"reason":"ide-classic-handoff","requested":"stateful-experimental","actual":"classic","phase":"classic"}\n'

function acquire() {
  harness.handles.push({ path: 'src/pages/index/index.json', acquiredSequence: ++harness.sequence, stopEvents: 0 })
}

function stop(handles: PollingHandle[]) {
  for (const handle of handles) {
    handle.stopEvents++
    handle.stoppedSequence = ++harness.sequence
  }
}

beforeEach(() => {
  harness.createServer.mockReset()
  harness.files.clear()
  harness.handles.length = 0
  harness.sequence = 0
  harness.failure = ''
  harness.staleFile = ''
  harness.restarts.length = 0
  harness.close.mockReset()
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  harness.createServer.mockImplementation(async (config) => {
    let closed = false
    const server = {
      config: { ...config, experimental: { bundledDev: harness.failure === 'stateful' } },
      watcher: { on: vi.fn() },
      restart: vi.fn(async (force: boolean) => {
        harness.restarts.push(force)
        if (harness.failure === 'stateful-restart') {
          server.config.experimental.bundledDev = true
        }
        const active = harness.handles.filter(handle => handle.stopEvents === 0)
        if (harness.failure !== 'overlapping-restart') {
          stop(active)
        }
        acquire()
        if (harness.failure === 'overlapping-restart') {
          stop(active)
        }
        for (const plugin of config.plugins) {
          plugin.configureServer?.(server)
        }
        if (harness.failure === 'repeated-fallback') {
          process.stdout.write(fallback + ready)
        }
      }),
      close: harness.close.mockImplementation(async () => {
        if (!closed) {
          closed = true
          stop(harness.handles.filter(handle => handle.stopEvents === 0))
          harness.files.delete(classicLease)
          if (harness.failure !== 'private-restore') {
            harness.files.set(privateFile, originalConfig)
          }
        }
      }),
    }
    harness.files.set(privateFile, '{"setting":{"compileHotReLoad":false}}')
    harness.files.set(classicLease, '{}')
    for (const file of ['app.js', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml']) {
      harness.files.set(path.join(outDir, file), file.endsWith('.json') ? '{}' : 'fixture')
    }
    harness.files.set(path.join(outDir, 'shared/marker.txt'), 'before-shared-mutation')
    if (harness.staleFile) {
      harness.files.set(path.join(root, harness.staleFile), 'stale stateful resource')
    }
    acquire()
    process.stdout.write(harness.failure === 'wrong-reason' ? fallback.replace('ide-classic-handoff', 'stylesheet-output') : fallback)
    if (harness.failure !== 'missing-readiness') {
      process.stderr.write(ready)
    }
    for (const plugin of config.plugins) {
      plugin.configureServer?.(server)
    }
    return server
  })
})

afterEach(() => vi.restoreAllMocks())

function context() {
  return { root, owners: [], errors: [], instrumentation: { pollingHandles: harness.handles }, evidence: {} as Record<string, unknown> }
}

it('polling 入口仅关闭 WebSocket，保留 classic hotUpdate 与明确的 stateful 配置请求', async () => {
  harness.createServer.mockRejectedValueOnce(harness.initializationError)
  const stdout = process.stdout.write
  const stderr = process.stderr.write
  await expect(pollingHostHandoff(context())).rejects.toBe(harness.initializationError)
  expect(process.stdout.write).toBe(stdout)
  expect(process.stderr.write).toBe(stderr)
  expect(harness.createServer).toHaveBeenCalledOnce()
  const config = harness.createServer.mock.calls[0]![0]
  expect(config.server.ws).toBe(false)
  expect(config.server.hmr).not.toBe(false)
  expect(config.server.watch).toEqual({ usePolling: true, interval: 100 })
  expect(config.weapp.hmr.runtime).toBe('stateful-experimental')
})

it('启动 classic 后保留 polling 编辑、恢复与两次有序配置重启，并释放原始配置所有权', async () => {
  const ctx = context()
  const stdout = process.stdout.write
  const stderr = process.stderr.write
  await pollingHostHandoff(ctx)
  expect(ctx.evidence).toMatchObject({
    requestedRuntime: 'stateful-experimental',
    actualRuntime: 'classic',
    startupFallbackReason: 'ide-classic-handoff',
    actualStatefulStarted: false,
    statefulArtifactsAbsent: true,
    hostGenerations: Array.from({ length: 3 }, () => ({ actualRuntime: 'classic' })),
    pollingRestarts: [{ force: false, stoppedBeforeReplacement: true }, { force: true, stoppedBeforeReplacement: true }],
    oldPollingStoppedBeforeRestartAcquisition: true,
    classicOutputUpdated: true,
    sourceRestored: true,
    privateConfigRestored: true,
    classicLeaseReleased: true,
    configRestarts: 2,
    requestedRuntimeUnchanged: true,
  })
  expect(harness.restarts).toEqual([false, true])
  expect(harness.close).toHaveBeenCalledTimes(2)
  expect(harness.handles).toHaveLength(3)
  expect(harness.handles.every(handle => handle.stopEvents === 1)).toBe(true)
  expect(harness.files.get(privateFile)).toBe(originalConfig)
  expect(harness.files.get(path.join(root, 'src/shared/marker.txt'))).toBe('before-shared-mutation')
  expect(harness.files.get(path.join(root, 'src/pages/index/index.json'))).toBe('{}')
  expect(harness.files.has(classicLease)).toBe(false)
  expect(process.stdout.write).toBe(stdout)
  expect(process.stderr.write).toBe(stderr)
})

it.each([
  ['stateful', 'No stateful host watcher'],
  ['stateful-restart', 'cannot install a stateful host watcher'],
  ['wrong-reason', 'ide-classic-handoff'],
  ['missing-readiness', 'ready exactly once'],
  ['overlapping-restart', 'Old host polling must fully stop'],
  ['repeated-fallback', 'exactly one startup capability decision'],
  ['private-restore', 'exact original private config'],
])('拒绝 %s 而非将其计为 classic 通过', async (failure, message) => {
  harness.failure = failure
  await expect(pollingHostHandoff(context())).rejects.toThrow(message)
})

it.each([
  ...[WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE].map(file => `.weapp-vite/delivery-host/${file}`),
  '.weapp-vite/ide-asset-watch.json',
])('拒绝启动时遗留的 stateful 资源 %s', async (file) => {
  harness.staleFile = file
  await expect(pollingHostHandoff(context())).rejects.toThrow()
})

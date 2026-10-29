import type { Plugin, PluginContext, ResolvedConfig } from 'vite'
import type { MutableCompilerContext } from '../context'
import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { subscribeAutoRoutesTopology } from '../runtime/autoRoutesPlugin/topology'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoRoutes } from './autoRoutes'

const watches = vi.hoisted(() => vi.fn())
vi.mock('chokidar', () => ({ default: { watch: watches } }))
vi.mock('../context/shared', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function fixture() {
  const route = '/project/src/pages/restored/index.js'
  const events = new EventEmitter()
  // fake watcher 自身接收 error；插件须另外把初始化失败传回原生构建 promise。
  events.on('error', () => {})
  let scanning = true
  let ignoreInitial = true
  const watcher = {
    on: events.on.bind(events),
    once: events.once.bind(events),
    off: events.off.bind(events),
    add: vi.fn(),
    close: vi.fn(async () => {
      events.removeAllListeners()
      events.on('error', () => {})
    }),
  }
  watches.mockImplementation((_paths, options: { ignoreInitial?: boolean }) => {
    ignoreInitial = options.ignoreInitial !== false
    return watcher
  })
  let signature = 'without-restored-page'
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      isDev: true,
      relativeCwd: (file: string) => file.replace('/project/', ''),
      weappViteConfig: { autoRoutes: true },
      packageInfo: { rootPath: '/package' },
    },
    scanService: { markDirty: vi.fn() },
    autoRoutesService: {
      isEnabled: () => true,
      getWatchDirectories: () => ['/project/src/pages'],
      isPageDeclarationSource: () => false,
      getPageDeclarationOwners: () => [],
      getSignature: () => signature,
      getSourceFingerprint: () => undefined,
      handleFileChange: vi.fn(async () => {
        signature = 'with-restored-page'
        return true
      }),
    },
  } as unknown as MutableCompilerContext
  const plugin = autoRoutes(ctx)[0] as Plugin
  plugin.configResolved?.({ command: 'build' } as ResolvedConfig)
  return {
    ctx,
    route,
    watcher,
    start: () => plugin.buildStart?.call({ meta: { watchMode: false } } as PluginContext),
    finishScan() {
      scanning = false
      events.emit('ready')
    },
    failScan: (error: Error) => events.emit('error', error),
    listenerCount: (event: string) => events.listenerCount(event),
    restoreRoute() {
      // ignoreInitial 把初扫期间发现的文件纳入基线；它不会为该文件补发 add。
      if (!scanning || !ignoreInitial) {
        events.emit('add', route)
      }
    },
    cleanup: async () => {
      await Promise.all([...ctx.runtimeState.watcher.sidecarWatcherMap.values()].map(controller => controller.close()))
    },
  }
}

it('waits for the physical route watcher before completing development buildStart', async () => {
  const project = fixture()
  let completed = false
  const started = Promise.resolve(project.start()).then(() => {
    completed = true
  })
  try {
    await Promise.resolve()
    expect(completed).toBe(false)
    project.finishScan()
    await started
    expect(completed).toBe(true)
  }
  finally {
    project.finishScan()
    await started
    await project.cleanup()
  }
})

it('propagates the original route watcher initialization error and removes readiness listeners', async () => {
  const project = fixture()
  const error = new Error('route initial crawl failed')
  const started = Promise.resolve(project.start())
  const failed = expect(started).rejects.toBe(error)
  const owner = [...project.ctx.runtimeState.watcher.sidecarWatcherMap.values()][0]!
  try {
    project.failScan(error)
    await failed
    expect(project.listenerCount('ready')).toBe(0)
    // 初始化失败会自动回收本次物理订阅，仅保留 fixture 自身的原始错误观察者。
    expect(project.listenerCount('error')).toBe(1)
    // 关闭仍交付注册原错，重复释放不能隐藏失败或再次关闭物理订阅。
    await expect(owner.close()).rejects.toBe(error)
    await expect(owner.close()).rejects.toBe(error)
    expect(project.watcher.close).toHaveBeenCalledOnce()
    expect(project.ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
  }
  finally {
    project.finishScan()
    await started.catch(() => {})
    await project.cleanup().catch(failure => expect(failure).toBe(error))
  }
})

it('settles a pending initialization when its owning route watcher closes', async () => {
  const project = fixture()
  const started = Promise.resolve(project.start())
  try {
    await project.cleanup()
    await started
    await project.cleanup()
    expect(project.listenerCount('ready')).toBe(0)
    expect(project.listenerCount('error')).toBe(1)
    expect(project.watcher.close).toHaveBeenCalledOnce()
    expect(project.ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
  }
  finally {
    project.finishScan()
    await started.catch(() => {})
    await project.cleanup()
  }
})

it('publishes a restored route saved immediately after the initial build hook completes', async () => {
  vi.useFakeTimers()
  const project = fixture()
  const consume = vi.fn()
  const release = subscribeAutoRoutesTopology(project.ctx, consume)
  const published = Promise.resolve(project.start()).then(() => project.restoreRoute())
  try {
    // 保持初扫 gate 关闭一个微任务，让过早完成的构建真实落入 ignoreInitial 窗口。
    await Promise.resolve()
    project.finishScan()
    await published
    await vi.runAllTimersAsync()
    expect(project.ctx.autoRoutesService!.handleFileChange).toHaveBeenCalledWith(project.route, 'rename')
    expect(consume).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ file: project.route, event: 'create', topologyChanged: true }))
  }
  finally {
    release()
    project.finishScan()
    await published
    await project.cleanup()
  }
})

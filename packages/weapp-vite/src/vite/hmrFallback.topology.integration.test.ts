import type { Plugin, ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { WeappVitePluginApi } from '../types'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it, onTestFailed, vi } from 'vitest'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { weapp } from './index'

// 模拟具有增量能力的底层宿主，保留 stateful 交接覆盖；真实微信启动准入另测。
vi.mock('../runtime/hmrRuntimeHostCapabilities', () => ({
  resolveStatefulHmrStartupFallback: () => undefined,
}))

const addedRoute = 'pages/added/index'
const homeScript = 'src/pages/home/index.js'
const deliveryFiles = [
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
]

async function fixture(initialAddedRoute: boolean) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-topology-')))
  const startedAt = performance.now()
  let eventSequence = 0
  let droppedWatcherEvents = 0
  const watcherEvents: Array<{ sequence: number, elapsedMs: number, host: number, event: string, file?: string }> = []
  const relativeFile = (file: string) => {
    const relative = path.relative(root, path.resolve(root, file))
    return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
      ? '<external>'
      : relative.replaceAll('\\', '/') || '.'
  }
  const recordWatcherEvent = (host: number, event: string, file?: string) => {
    if (watcherEvents.length === 128) {
      watcherEvents.shift()
      droppedWatcherEvents++
    }
    watcherEvents.push({ sequence: ++eventSequence, elapsedMs: performance.now() - startedAt, host, event, file: file && relativeFile(file) })
  }
  const hosts: Array<{
    server: ViteDevServer
    watcher: ViteDevServer['watcher']
    watcherCloseCalls: () => number
    wsCloseCalls: () => number
    restore: () => void
  }> = []
  let runtime: HmrRuntimeSession | undefined
  for (const [file, content] of Object.entries({
    'package.json': '{"name":"classic-topology-fixture","type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist"}',
    'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
    'src/app.js': 'App({})',
    'src/app.json': '{"entryPagePath":"pages/home/index"}',
    [homeScript]: 'Page({ data: { marker: "topology-initial" } })',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{marker}}</view>',
  })) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  const routeDirectory = path.join(root, 'src/pages/added')
  const stagingDirectory = path.join(root, 'route-staging')
  await mkdir(initialAddedRoute ? routeDirectory : stagingDirectory, { recursive: true })
  for (const [extension, content] of Object.entries({
    js: 'Page({ data: { marker: "topology-added-route" } })',
    json: '{"navigationBarTitleText":"topology-added-title"}',
    wxml: '<view>{{marker}}</view>',
  })) {
    await writeFile(path.join(initialAddedRoute ? routeDirectory : stagingDirectory, `index.${extension}`), content)
  }
  const probe: Plugin = {
    name: 'classic-topology-host-probe',
    enforce: 'pre',
    configureServer(server) {
      const host = hosts.length
      const onAll = (event: string, file: string) => recordWatcherEvent(host, event, file)
      const onReady = () => recordWatcherEvent(host, 'ready')
      server.watcher.on('all', onAll).on('ready', onReady)
      recordWatcherEvent(host, (server.watcher as typeof server.watcher & { _readyEmitted?: boolean })._readyEmitted ? 'attached-after-ready' : 'attached-before-ready')
      const watcherClose = vi.spyOn(server.watcher, 'close')
      const wsClose = vi.spyOn(server.ws, 'close')
      hosts.push({
        server,
        watcher: server.watcher,
        watcherCloseCalls: () => watcherClose.mock.calls.length,
        wsCloseCalls: () => wsClose.mock.calls.length,
        restore() {
          server.watcher.off('all', onAll).off('ready', onReady)
          watcherClose.mockRestore()
          wsClose.mockRestore()
        },
      })
      // 只从首代 stateful 宿主取得命令级会话；classic 的编译上下文由原生子构建持有。
      if (!runtime) {
        const api = server.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
        if (!api) {
          throw new Error('Topology fixture did not expose its initial compiler context')
        }
        runtime = getHmrRuntimeSession(api.ctx)
      }
    },
  }
  return {
    root,
    hosts,
    runtime: () => runtime!,
    inspect: () => hosts.map((host) => {
      const api = host.server.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
      return {
        bundledDev: host.server.config.experimental.bundledDev,
        routes: api?.ctx.autoRoutesService.getSnapshot(),
        fullEntryScan: api?.ctx.runtimeState.build.hmr.fullEntryScan,
        watcherClosed: host.watcherCloseCalls(),
      }
    }),
    diagnose: async () => ({
      phase: runtime?.phase,
      fallback: runtime?.fallback && { ...runtime.fallback, files: runtime.fallback.files?.map(relativeFile) },
      sources: await Promise.all([
        homeScript,
        'src/app.json',
        `src/${addedRoute}.js`,
        'route-staging/index.js',
      ].map(async file => ({
        file,
        source: await readFile(path.join(root, file), 'utf8').catch((error: NodeJS.ErrnoException) => ({ errorCode: error.code })),
      }))),
      hosts: hosts.map(host => ({
        bundledDev: host.server.config.experimental.bundledDev,
        watcherClosed: host.watcher.closed,
        watcherReady: (host.watcher as typeof host.watcher & { _readyEmitted?: boolean })._readyEmitted,
        watched: Object.entries(host.watcher.getWatched()).map(([directory, files]) => ({ directory: relativeFile(directory), files })),
      })),
      watcherEvents: [...watcherEvents],
      droppedWatcherEvents,
    }),
    read: (file: string) => readFile(path.join(root, 'dist', file), 'utf8'),
    save: (marker: string) => writeFile(path.join(root, homeScript), `Page({ data: { marker: ${JSON.stringify(marker)} } })`),
    changeTopology: () => initialAddedRoute ? rename(routeDirectory, stagingDirectory) : rename(stagingDirectory, routeDirectory),
    restoreTopology: () => initialAddedRoute ? rename(stagingDirectory, routeDirectory) : rename(routeDirectory, stagingDirectory),
    start: () => createServer({
      root,
      configFile: false,
      // Vite 重启会吞初始化拒绝；保留原始 error 日志用于定位交接门禁失败。
      logLevel: 'error',
      weapp: { srcRoot: 'src', autoRoutes: true, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
      // 没有 Web 客户端；只关闭浏览器 WebSocket，保留原生编译 watcher 与 stateful HTTP transport。
      server: { middlewareMode: true, host: '127.0.0.1', port: 0, ws: false },
      plugins: [probe, weapp()],
    }),
    cleanup: async () => {
      try {
        await Promise.all(hosts.map(host => host.server.close()))
      }
      finally {
        for (const host of hosts) {
          host.restore()
        }
        await rm(root, { recursive: true, force: true })
      }
    },
  }
}

it.each(['create', 'delete'] as const)('hands atomic route-directory %s and an immediate script save to classic', async (event) => {
  const project = await fixture(event === 'delete')
  let server: ViteDevServer | undefined
  let routesDiagnostic: unknown
  let failureDiagnostic: unknown
  onTestFailed(async () => {
    process.stderr.write(`[classic-topology] ${JSON.stringify({ lastRoutesCheck: routesDiagnostic, failure: failureDiagnostic ?? await project.diagnose() })}\n`)
  })
  const expectRoutes = async (containsAddedRoute: boolean, checkpoint: string) => {
    // 原生 write 可并发发布文件；App JSON 就绪不能代替整个路由产物组就绪。
    await vi.waitFor(async () => {
      const app = JSON.parse(await project.read('app.json')) as { pages?: string[] }
      const source = await readFile(path.join(project.root, 'src', `${addedRoute}.js`), 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return undefined
        }
        throw error
      })
      routesDiagnostic = { checkpoint, event, phase: project.runtime().phase, containsAddedRoute, emittedPages: app.pages, sourcePresent: source !== undefined, hosts: project.inspect() }
      expect(app.pages?.includes(addedRoute), `route publication at ${checkpoint}`).toBe(containsAddedRoute)
      if (containsAddedRoute) {
        expect(await project.read(`${addedRoute}.js`)).toContain('topology-added-route')
        expect(JSON.parse(await project.read(`${addedRoute}.json`)) as unknown).toMatchObject({ navigationBarTitleText: 'topology-added-title' })
        expect(await project.read(`${addedRoute}.wxml`)).toContain('{{marker}}')
      }
    }, { timeout: 15_000 })
  }
  const expectClassic = async () => {
    expect(project.runtime().phase).toBe('classic')
    expect(server!.config.experimental.bundledDev).toBe(false)
    expect(Object.values(server!.config.define).join('\n')).not.toContain(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
    for (const file of deliveryFiles) {
      await expect(readFile(path.join(project.root, 'dist', file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  }
  try {
    server = await project.start()
    expect(server.config.experimental.bundledDev).toBe(true)
    await expectRoutes(event === 'delete', 'initial-stateful')
    // 完整页面目录先原子移动，再立即保存既有页面；不能靠 App 文件的模拟 change 触发能力回退。
    await project.changeTopology()
    await project.save('saved-with-route-topology')
    await expect.poll(() => project.runtime().fallback?.code, { timeout: 15_000 }).toBe('entry-topology')
    await project.runtime().whenSettled()
    await expectClassic()
    await expectRoutes(event === 'create', 'classic-handoff')
    await expect.poll(() => project.read('pages/home/index.js')).toContain('saved-with-route-topology')
    expect(project.runtime().fallback?.files).toEqual(expect.arrayContaining([
      path.join(project.root, 'src/pages/added/index.js').replaceAll('\\', '/'),
    ]))
    expect(project.hosts).toHaveLength(2)
    expect(project.hosts[0]!.watcherCloseCalls()).toBe(1)
    expect(project.hosts[0]!.wsCloseCalls()).toBe(1)
    expect(project.hosts[0]!.watcher.getWatched()).toEqual({})

    await project.restoreTopology()
    await project.save('saved-after-route-restoration')
    await expectRoutes(event === 'delete', 'classic-restoration')
    await expect.poll(() => project.read('pages/home/index.js')).toContain('saved-after-route-restoration')
    await expectClassic()
    expect(project.hosts).toHaveLength(2)

    await server.restart(true)
    await project.save('saved-after-host-restart')
    await expect.poll(() => project.read('pages/home/index.js')).toContain('saved-after-host-restart')
    await expectClassic()
    await Promise.all([server.close(), server.close()])
    for (const host of project.hosts) {
      expect(host.watcherCloseCalls()).toBe(1)
      expect(host.wsCloseCalls()).toBe(1)
      expect(host.watcher.getWatched()).toEqual({})
    }
    expect(JSON.parse(await readFile(path.join(project.root, 'project.private.config.json'), 'utf8')) as unknown).toEqual({ setting: { compileHotReLoad: true } })
  }
  catch (error) {
    // onTestFailed 在 finally 清理后运行，必须先冻结仍存活的文件与 watcher 状态。
    failureDiagnostic = await project.diagnose().catch(error => ({ diagnosticError: error instanceof Error ? error.name : 'unknown' }))
    throw error
  }
  finally {
    try {
      await server?.close()
    }
    finally {
      await project.cleanup()
    }
  }
}, 60_000)

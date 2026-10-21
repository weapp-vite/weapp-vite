import type { Plugin, ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { WeappVitePluginApi } from '../types'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { weapp } from './index'

const addedRoute = 'pages/added/index'
const homeScript = 'src/pages/home/index.js'
const deliveryFiles = [
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
]

async function fixture(initialAddedRoute: boolean) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-topology-')))
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
      const watcherClose = vi.spyOn(server.watcher, 'close')
      const wsClose = vi.spyOn(server.ws, 'close')
      hosts.push({
        server,
        watcher: server.watcher,
        watcherCloseCalls: () => watcherClose.mock.calls.length,
        wsCloseCalls: () => wsClose.mock.calls.length,
        restore() {
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
  const expectRoutes = async (containsAddedRoute: boolean) => {
    await expect.poll(async () => {
      const app = JSON.parse(await project.read('app.json')) as { pages?: string[] }
      return app.pages?.includes(addedRoute)
    }, { timeout: 15_000 }).toBe(containsAddedRoute)
    if (containsAddedRoute) {
      expect(await project.read(`${addedRoute}.js`)).toContain('topology-added-route')
      expect(JSON.parse(await project.read(`${addedRoute}.json`)) as unknown).toMatchObject({ navigationBarTitleText: 'topology-added-title' })
      expect(await project.read(`${addedRoute}.wxml`)).toContain('{{marker}}')
    }
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
    await expectRoutes(event === 'delete')
    // 完整页面目录先原子移动，再立即保存既有页面；不能靠 App 文件的模拟 change 触发能力回退。
    await project.changeTopology()
    await project.save('saved-with-route-topology')
    await expect.poll(() => project.runtime().fallback?.code, { timeout: 15_000 }).toBe('entry-topology')
    await project.runtime().whenSettled()
    await expectClassic()
    await expectRoutes(event === 'create')
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
    await expectRoutes(event === 'delete')
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
  finally {
    try {
      await server?.close()
    }
    finally {
      await project.cleanup()
    }
  }
}, 60_000)

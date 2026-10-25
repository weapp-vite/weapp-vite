import type { Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../../../../packages-runtime/web/src/plugin'
import { createWebRestoreNotifications } from '../../test/helpers/webRestoreNotifications'
import { createBarrier } from '../../test/helpers/webRestoreScanGate'
import { createAutoRoutesService } from '../runtime/autoRoutesPlugin/service'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoRoutes } from './autoRoutes'

const sidecarHandlers = vi.hoisted(() => new Map<string, (file: string) => void>())
vi.mock('chokidar', () => ({
  default: {
    watch() {
      const events = new EventEmitter()
      void Promise.resolve().then(() => events.emit('ready'))
      return {
        add() {},
        on(event: string, handler: (file: string) => void) {
          sidecarHandlers.set(event, handler)
          return events.on(event, handler)
        },
        once: events.once.bind(events),
        off: events.off.bind(events),
        close() {
          sidecarHandlers.clear()
          events.removeAllListeners()
        },
      }
    },
  },
}))

it('publishes a physical rename once when add arrives after the completed unlink publication', async () => {
  sidecarHandlers.clear()
  const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-route-rename-'))))
  const srcRoot = path.join(root, 'src')
  const app = path.join(srcRoot, 'app.vue')
  const previous = path.join(srcRoot, 'pages/profile/index.vue')
  const moved = path.join(srcRoot, 'pages/moved/index.vue')
  const declaration = path.join(srcRoot, 'pageScripts/profile.mjs')
  const template = path.join(srcRoot, 'pageTemplates/profile.html')
  const style = path.join(srcRoot, 'pageStyles/profile.css')
  const notifications = createWebRestoreNotifications()
  const firstReload = createBarrier()
  const reloads: Array<string[] | undefined> = []
  const errors: unknown[] = []
  let cachedConfig: { pages: string[] } | undefined
  let resolvedPages: string[] | undefined
  let server: ViteDevServer | undefined
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: root,
      absoluteSrcRoot: srcRoot,
      isDev: true,
      weappWebConfig: { enabled: true },
      weappViteConfig: { autoRoutes: true },
      relativeCwd: (file: string) => path.relative(root, file),
      packageInfo: { rootPath: path.resolve(import.meta.dirname, '../..') },
    },
    jsonService: { read: async () => undefined },
    scanService: {
      appEntry: { path: app },
      markDirty() { cachedConfig = undefined },
    },
  } as unknown as MutableCompilerContext
  const service = createAutoRoutesService(ctx)
  ctx.autoRoutesService = service
  const notify = (file: string, event: 'add' | 'unlink') => notifications.source(file, event, () => {
    expect(sidecarHandlers.get(event)).toBeTypeOf('function')
    sidecarHandlers.get(event)!(file)
  })
  try {
    await mkdir(path.dirname(previous), { recursive: true })
    await mkdir(path.join(srcRoot, 'pages/home'), { recursive: true })
    await mkdir(path.dirname(declaration), { recursive: true })
    await mkdir(path.dirname(template), { recursive: true })
    await mkdir(path.dirname(style), { recursive: true })
    await writeFile(app, '<script setup>import "wevu/router/auto-routes"</script>')
    await writeFile(path.join(srcRoot, 'app.json'), '{}')
    await writeFile(path.join(srcRoot, 'pages/home/index.js'), 'Page({})')
    await writeFile(declaration, 'definePage({ name: "profile", meta: { title: "Profile" } }); const message = "profile"')
    await writeFile(template, '<view>{{ message }}</view>')
    await writeFile(style, 'view { color: red; }')
    await writeFile(previous, '<script setup src="../../pageScripts/profile.mjs"></script><template src="../../pageTemplates/profile.html"></template><style src="../../pageStyles/profile.css"></style>')
    await service.ensureFresh()
    const webPlugin = weappWebPlugin({
      __runtimeProvider: {
        moduleId: 'virtual:test-runtime',
        hmrAcceptCode: 'if (import.meta.hot) { import.meta.hot.accept() }',
      },
      async __resolveAppConfig() {
        const config = cachedConfig ??= { pages: [...service.getSnapshot().pages] }
        resolvedPages = [...config.pages]
        return config
      },
    })
    server = await createServer({
      root,
      configFile: false,
      plugins: [webPlugin as Plugin, ...autoRoutes(ctx), {
        name: 'test-runtime',
        config: () => ({ weappVite: { name: 'weapp-vite', runtime: 'web' } }),
        resolveId: id => id === 'virtual:test-runtime' ? '\0test-runtime' : null,
        load: id => id === '\0test-runtime' ? 'export const initializePageRoutes = () => {}' : null,
      }],
      optimizeDeps: { noDiscovery: true },
      server: { middlewareMode: true, watch: null, hmr: { port: 0 } },
      logLevel: 'silent',
    })
    const watchChange = server.pluginContainer.watchChange.bind(server.pluginContainer)
    vi.spyOn(server.pluginContainer, 'watchChange').mockImplementation((file, change) => notifications.watchChange(
      file,
      change,
      () => watchChange(file, change),
    ))
    await server.transformRequest('/@weapp-vite/web/entry')
    await server.transformRequest('/src/app.vue')
    await server.transformRequest('wevu/router/auto-routes')
    server.environments.client!.hot.send = ((payload: { type?: string }) => {
      if (payload.type === 'full-reload') {
        reloads.push(resolvedPages)
        firstReload.release()
      }
      else if (payload.type === 'error') {
        errors.push(payload)
      }
    }) as typeof server.environments.client.hot.send

    // 物理目录先完成移动，unlink 扫描必须采纳移动后的完整页面和外部声明源码。
    await rename(path.dirname(previous), path.dirname(moved))
    await notify(previous, 'unlink')
    await firstReload.promise
    expect(reloads).toEqual([['pages/home/index', 'pages/moved/index']])
    expect(service.getSourceFingerprint(previous)).toBeUndefined()
    expect(service.getSourceFingerprint(moved)).toBeTypeOf('string')
    expect(service.getSourceFingerprint(declaration)).toBeTypeOf('string')
    // 通用 SFC 解析器还读取外部模板与样式，它们属于已接受的指纹集，不能用 watchFiles 拼出子集。
    expect(service.getSourceFingerprint(template)).toBeTypeOf('string')
    expect(service.getSourceFingerprint(style)).toBeTypeOf('string')
    expect([...service.getWatchFiles()]).not.toContain(template)
    expect([...service.getWatchFiles()]).not.toContain(style)
    expect(new Set(ctx.runtimeState.autoRoutes.pageDeclarationFingerprints.keys())).toEqual(new Set([
      path.join(srcRoot, 'pages/home/index.js'),
      moved,
      declaration,
      template,
      style,
    ]))
    const firstEntry = await server.transformRequest('/@weapp-vite/web/entry')
    expect(firstEntry?.code).toContain('/src/pages/moved/index.vue')
    expect(firstEntry?.code).not.toContain('/src/pages/profile/index.vue')

    // 首轮发布与入口消费完成后才发送 add，确定性覆盖跨批次通知。
    await notify(moved, 'add')
    const finalEntry = await server.transformRequest('/@weapp-vite/web/entry')
    expect(finalEntry?.code).toContain('/src/pages/moved/index.vue')
    expect(service.getNamedModuleCode()).toContain('/pages/moved/index')
    expect(service.getNamedModuleCode()).not.toContain('/pages/profile/index')
    expect(errors).toEqual([])
    expect(reloads).toEqual([['pages/home/index', 'pages/moved/index']])
  }
  finally {
    await server?.close()
    notifications.close()
    await rm(root, { recursive: true, force: true })
  }
})

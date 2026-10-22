import type { Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../../../../packages-runtime/web/src/plugin'
import { createWebRestoreNotifications } from '../../test/helpers/webRestoreNotifications'
import { createBarrier as barrier, createWebRestoreScanGate } from '../../test/helpers/webRestoreScanGate'
import { createAutoRoutesService } from '../runtime/autoRoutesPlugin/service'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoRoutes } from './autoRoutes'

const sourceWatchers = vi.hoisted(() => [] as Array<Map<string, (file: string) => void>>)
vi.mock('chokidar', () => ({
  default: {
    watch() {
      const callbacks = new Map<string, (file: string) => void>()
      const events = new EventEmitter()
      void Promise.resolve().then(() => events.emit('ready'))
      sourceWatchers.push(callbacks)
      return {
        add() {},
        on(event: string, handler: (file: string) => void) {
          callbacks.set(event, handler)
          return events.on(event, handler)
        },
        once: events.once.bind(events),
        off: events.off.bind(events),
        close() {
          callbacks.clear()
          events.removeAllListeners()
        },
      }
    },
  },
}))

it.each(['app-first', 'app-scan-in-flight', 'app-first-reimported', 'app-first-add-change-overlap', 'source-started-first', 'source-published-first'] as const)(
  'publishes one restored route generation when %s notifications overlap',
  async (order) => {
    sourceWatchers.length = 0
    const overlapsCreate = order === 'app-first-add-change-overlap'
    const overlapsScan = order === 'app-scan-in-flight'
    const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-route-restore-'))))
    const srcRoot = path.join(root, 'src')
    const scriptRoot = path.join(srcRoot, 'pageScripts')
    const app = path.join(srcRoot, 'app.vue')
    const restored = path.join(srcRoot, 'pages/restored/index.vue')
    const pageSource = '<script setup src="@page-scripts/restored.mjs"></script><template><view>{{ message }}</view></template>'
    const sourceStarted = barrier()
    const releaseSource = barrier()
    const createStarted = barrier()
    const releaseCreate = barrier()
    const scanGate = createWebRestoreScanGate(restored)
    const notifications = createWebRestoreNotifications()
    const sourceNotifications: string[] = []
    const reloads: Array<{ source?: string, pages?: string[] }> = []
    const errors: unknown[] = []
    let blockSourceUpdate = false
    let blockCreateUpdate = false
    let cachedConfig: { pages: string[] } | undefined
    // 缓存失效只影响下次解析；发布观察使用 resolver 实际交付的配置。
    let resolvedConfig: { pages: string[] } | undefined
    let server: ViteDevServer | undefined
    const ctx = {
      runtimeState: createRuntimeState(),
      configService: {
        cwd: root,
        absoluteSrcRoot: srcRoot,
        isDev: true,
        inlineConfig: { resolve: { alias: { '@page-scripts': scriptRoot } } },
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
    const handleFileChange = service.handleFileChange.bind(service)
    const handleChange = vi.spyOn(service, 'handleFileChange').mockImplementation(async (file, event) => {
      if (blockSourceUpdate && file === restored && event === 'update') {
        sourceStarted.release()
        await releaseSource.promise
      }
      return handleFileChange(file, event)
    })
    const sourceEvent = (event: 'add' | 'unlink') => {
      expect(sourceWatchers).toHaveLength(1)
      const callback = sourceWatchers[0]!.get(event)
      expect(callback).toBeTypeOf('function')
      return notifications.source(restored, event, () => callback!(restored))
    }
    const nativeEvent = (event: 'add' | 'change' | 'unlink') => notifications.native(
      restored,
      event,
      () => { server!.watcher.emit(event, restored) },
    )
    const transformPublishedEntry = async () => {
      const entry = await server!.transformRequest('/@weapp-vite/web/entry')
      await server!.transformRequest('/src/app.vue')
      await server!.transformRequest('/src/app.vue.css?weapp-web-sfc-style&inline')
      await server!.transformRequest('wevu/router/auto-routes')
      return entry
    }
    const transformRestoredPage = async () => {
      await server!.transformRequest('/src/pages/restored/index.vue')
      await server!.transformRequest('/src/pages/restored/index.vue?weapp-web-sfc-template')
      await server!.transformRequest('/src/pages/restored/index.vue.css?weapp-web-sfc-style&inline')
    }
    try {
      await mkdir(path.dirname(restored), { recursive: true })
      await mkdir(path.join(srcRoot, 'pages/home'), { recursive: true })
      await mkdir(scriptRoot)
      await writeFile(path.join(scriptRoot, 'restored.mjs'), 'definePage({ name: "restored" }); const message = "restored"')
      await writeFile(app, '<script setup>import "wevu/router/auto-routes"</script>')
      await writeFile(path.join(srcRoot, 'app.json'), '{}')
      await writeFile(path.join(srcRoot, 'pages/home/index.js'), 'Page({})')
      await writeFile(restored, pageSource)
      await service.ensureFresh()
      const webPlugin = weappWebPlugin({
        __runtimeProvider: {
          moduleId: 'virtual:test-runtime',
          hmrAcceptCode: 'if (import.meta.hot) { import.meta.hot.accept() }',
        },
        async __resolveAppConfig() {
          const config = cachedConfig ??= { pages: [...service.getSnapshot().pages] }
          await scanGate.blockScan()
          resolvedConfig = config
          return config
        },
      })
      scanGate.observeHotUpdate(webPlugin)
      server = await createServer({
        root,
        configFile: false,
        plugins: [webPlugin as Plugin, ...autoRoutes(ctx), {
          name: 'test-runtime',
          config: () => ({ weappVite: { name: 'weapp-vite', runtime: 'web' } }),
          resolveId: id => id === 'virtual:test-runtime' ? '\0test-runtime' : null,
          load: id => id === '\0test-runtime' ? 'export const initializePageRoutes = () => {}' : null,
          watchChange: overlapsCreate
            ? {
                order: 'post',
                sequential: true,
                async handler(file, change) {
                  if (blockCreateUpdate && file === restored && change.event === 'create') {
                    createStarted.release()
                    await releaseCreate.promise
                  }
                },
              }
            : undefined,
          hotUpdate: overlapsCreate
            ? {
                order: 'post',
                handler(context) {
                  if (this.environment.name === 'client' && context.file === restored) {
                    sourceNotifications.push(context.type)
                  }
                },
              }
            : undefined,
        }],
        optimizeDeps: { noDiscovery: true },
        resolve: { alias: { '@page-scripts': scriptRoot } },
        server: {
          middlewareMode: true,
          watch: null,
          hmr: { port: 0 },
          async hotUpdateEnvironments(vite, hmr) {
            await notifications.hotUpdateEnvironments(() => Promise.all(Object.values(vite.environments).map(hmr)))
          },
        },
        logLevel: 'silent',
      })
      const watchChange = server.pluginContainer.watchChange.bind(server.pluginContainer)
      vi.spyOn(server.pluginContainer, 'watchChange').mockImplementation((file, change) => notifications.watchChange(
        file,
        change,
        () => watchChange(file, change),
      ))
      server.environments.client!.hot.send = ((payload: { type?: string, triggeredBy?: string }) => {
        if (payload.type === 'full-reload') {
          reloads.push({ source: payload.triggeredBy, pages: resolvedConfig && [...resolvedConfig.pages] })
        }
        else if (payload.type === 'error') {
          errors.push(payload)
        }
      }) as typeof server.environments.client.hot.send
      await transformPublishedEntry()
      await transformRestoredPage()

      // 先完整发布删除并让 Vite 收到同一物理 unlink，保留真实删除恢复的模块图。
      await rm(restored)
      await sourceEvent('unlink')
      await nativeEvent('unlink')
      expect(service.getSnapshot().pages).toEqual(['pages/home/index'])
      expect((await transformPublishedEntry())?.code).not.toContain('/src/pages/restored/index.vue')
      reloads.length = 0
      sourceNotifications.length = 0

      await writeFile(restored, pageSource)
      const reimportsPage = order === 'app-first-reimported' || overlapsCreate
      let sourceUpdate: Promise<void> | undefined
      if (order === 'source-started-first') {
        blockSourceUpdate = true
        sourceUpdate = nativeEvent('change')
        await sourceStarted.promise
      }
      if (order === 'source-published-first') {
        await nativeEvent('change')
        await sourceEvent('add')
      }
      else {
        if (overlapsScan) {
          scanGate.start()
        }
        const publication = sourceEvent('add')
        if (overlapsScan) {
          // App 使用恢复路由扫描但尚未提交；此时 source HMR 入队，不能提前采用删除快照。
          await scanGate.started
          expect(cachedConfig?.pages).toEqual(['pages/home/index', 'pages/restored/index'])
          sourceUpdate = nativeEvent('change')
          await scanGate.publishSource(publication)
        }
        await publication
      }
      // App 发布后才放行 source update，两个来源必须消费同一恢复 generation。
      if (order === 'source-started-first') {
        releaseSource.release()
      }
      else if (order === 'app-first' || reimportsPage) {
        if (reimportsPage) {
          // 浏览器先恢复入口、App 和路由依赖；页面可能尚未重新请求。
          expect((await transformPublishedEntry())?.code).toContain('/src/pages/restored/index.vue')
          await transformRestoredPage()
        }
        let createUpdate: Promise<void> | undefined
        if (overlapsCreate) {
          // 真实 watcher 可先报 add/change，但 create 的 hotUpdate 晚于 change 的 hotUpdate 完成。
          // 保留真实 Web watchChange 扫描，只在其后用屏障延迟 create 进入 HMR，不依赖计时。
          blockCreateUpdate = true
          createUpdate = nativeEvent('add')
          await createStarted.promise
        }
        await nativeEvent('change')
        if (overlapsCreate) {
          releaseCreate.release()
          await createUpdate
        }
      }
      await sourceUpdate
      if (overlapsScan) {
        expect(scanGate.stop()).toBe(2)
      }
      if (overlapsCreate) {
        expect(sourceNotifications).toEqual(['update', 'create'])
      }
      expect(errors).toEqual([])
      expect(handleChange.mock.calls.filter(([file, event]) => file === restored && event === 'update')).toHaveLength(1)
      expect(service.getSnapshot().pages).toEqual(['pages/home/index', 'pages/restored/index'])
      expect(reloads).toHaveLength(1)
      expect(reloads.map(reload => reload.source === undefined ? undefined : path.normalize(reload.source))).toEqual([
        order === 'source-published-first' || overlapsScan ? restored : undefined,
      ])
      expect(reloads[0]!.pages).toEqual(['pages/home/index', 'pages/restored/index'])
      expect((await transformPublishedEntry())?.code).toContain('/src/pages/restored/index.vue')
    }
    finally {
      releaseSource.release()
      releaseCreate.release()
      scanGate.close()
      handleChange.mockRestore()
      await server?.close()
      notifications.close()
      await rm(root, { recursive: true, force: true })
    }
  },
  15_000,
)

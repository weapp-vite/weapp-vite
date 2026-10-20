import type { Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../../../../packages-runtime/web/src/plugin'
import { createAutoRoutesService } from '../runtime/autoRoutesPlugin/service'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoRoutes } from './autoRoutes'

const sourceWatchers = vi.hoisted(() => [] as Array<Map<string, (file: string) => void>>)
vi.mock('chokidar', () => ({
  default: {
    watch() {
      const callbacks = new Map<string, (file: string) => void>()
      sourceWatchers.push(callbacks)
      return { add() {}, on: callbacks.set.bind(callbacks), close: () => callbacks.clear() }
    },
  },
}))

function barrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

it.each(['app-first', 'source-started-first', 'source-published-first'] as const)(
  'publishes one restored route generation when %s notifications overlap',
  async (order) => {
    sourceWatchers.length = 0
    const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-route-restore-'))))
    const srcRoot = path.join(root, 'src')
    const scriptRoot = path.join(srcRoot, 'pageScripts')
    const app = path.join(srcRoot, 'app.vue')
    const restored = path.join(srcRoot, 'pages/restored/index.vue')
    const pageSource = '<script setup src="@page-scripts/restored.mjs"></script><template><view>{{ message }}</view></template>'
    const sourceStarted = barrier()
    const releaseSource = barrier()
    const updateWaiters = new Map<number, ReturnType<typeof barrier>>()
    const reloads: Array<{ source?: string, pages?: string[] }> = []
    const errors: unknown[] = []
    let completedUpdates = 0
    let blockSourceUpdate = false
    let cachedConfig: { pages: string[] } | undefined
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
    const waitForUpdate = (target: number) => {
      if (completedUpdates >= target) {
        return Promise.resolve()
      }
      const done = barrier()
      updateWaiters.set(target, done)
      return done.promise
    }
    const sidecarEvent = (event: 'add' | 'unlink') => {
      expect(sourceWatchers).toHaveLength(1)
      const callback = sourceWatchers[0]!.get(event)
      expect(callback).toBeTypeOf('function')
      callback!(restored)
    }
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
          cachedConfig ??= { pages: [...service.getSnapshot().pages] }
          return cachedConfig
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
        resolve: { alias: { '@page-scripts': scriptRoot } },
        server: {
          middlewareMode: true,
          watch: null,
          hmr: { port: 0 },
          async hotUpdateEnvironments(vite, hmr) {
            await Promise.all(Object.values(vite.environments).map(hmr))
            completedUpdates += 1
            updateWaiters.get(completedUpdates)?.release()
            updateWaiters.delete(completedUpdates)
          },
        },
        logLevel: 'silent',
      })
      server.environments.client!.hot.send = ((payload: { type?: string, triggeredBy?: string }) => {
        if (payload.type === 'full-reload') {
          reloads.push({ source: payload.triggeredBy, pages: cachedConfig && [...cachedConfig.pages] })
        }
        else if (payload.type === 'error') {
          errors.push(payload)
        }
      }) as typeof server.environments.client.hot.send
      await transformPublishedEntry()
      await transformRestoredPage()

      // 先完整发布删除并让 Vite 收到同一物理 unlink，保留真实删除恢复的模块图。
      await rm(restored)
      let nextUpdate = completedUpdates + 1
      sidecarEvent('unlink')
      await waitForUpdate(nextUpdate)
      nextUpdate = completedUpdates + 1
      server.watcher.emit('unlink', restored)
      await waitForUpdate(nextUpdate)
      expect(service.getSnapshot().pages).toEqual(['pages/home/index'])
      expect((await transformPublishedEntry())?.code).not.toContain('/src/pages/restored/index.vue')
      reloads.length = 0

      await writeFile(restored, pageSource)
      const target = completedUpdates + 2
      if (order === 'source-started-first') {
        blockSourceUpdate = true
        server.watcher.emit('change', restored)
        await sourceStarted.promise
      }
      if (order === 'source-published-first') {
        server.watcher.emit('change', restored)
        await waitForUpdate(target - 1)
        sidecarEvent('add')
      }
      else {
        sidecarEvent('add')
        await waitForUpdate(target - 1)
      }
      // App 发布后才放行 source update，两个来源必须消费同一恢复 generation。
      if (order === 'source-started-first') {
        releaseSource.release()
      }
      else if (order === 'app-first') {
        server.watcher.emit('change', restored)
      }
      await waitForUpdate(target)
      expect(errors).toEqual([])
      expect(handleChange.mock.calls.filter(([file, event]) => file === restored && event === 'update')).toHaveLength(1)
      expect(service.getSnapshot().pages).toEqual(['pages/home/index', 'pages/restored/index'])
      expect(reloads.map(reload => path.relative(root, reload.source ?? ''))).toEqual([
        order === 'source-published-first' ? 'src/pages/restored/index.vue' : 'src/app.vue',
      ])
      expect(reloads[0]!.pages).toEqual(['pages/home/index', 'pages/restored/index'])
      expect((await transformPublishedEntry())?.code).toContain('/src/pages/restored/index.vue')
    }
    finally {
      releaseSource.release()
      handleChange.mockRestore()
      await server?.close()
      await rm(root, { recursive: true, force: true })
    }
  },
  15_000,
)

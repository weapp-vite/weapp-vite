import type { Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../../../../packages-runtime/web/src/plugin'
import { autoRoutes } from './autoRoutes'

vi.mock('chokidar', () => ({
  default: { watch: () => ({ add() {}, on() {}, close() {} }) },
}))

function barrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

it('publishes the refreshed Web entry before reloading a restored route source', async () => {
  const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-route-publication-'))))
  const srcRoot = path.join(root, 'src')
  const app = path.join(srcRoot, 'app.js')
  const restored = path.join(srcRoot, 'pages/restored/index.js')
  const coreStarted = barrier()
  const coreRelease = barrier()
  const webStarted = barrier()
  const webRelease = barrier()
  const reloadSent = barrier()
  let includeRestored = false
  let cachedConfig: { pages: string[] } | undefined
  let server: ViteDevServer | undefined
  const entriesAtReload: Array<ReturnType<ViteDevServer['transformRequest']>> = []
  const pages = () => ['pages/home/index', ...(includeRestored ? ['pages/restored/index'] : [])]
  const scanService = {
    appEntry: { path: app },
    markDirty() { cachedConfig = undefined },
  }
  const service = {
    isEnabled: () => true,
    ensureFresh: async () => {},
    getWatchFiles: () => [],
    getWatchDirectories: () => [srcRoot],
    getSignature: () => JSON.stringify(pages()),
    getModuleCode: () => `export const pages = ${JSON.stringify(pages())}`,
    getNamedModuleCode: () => `export const routes = ${JSON.stringify(pages())}`,
    isRouteFile: (file: string) => file === restored,
    isPageDeclarationSource: () => false,
    getPageDeclarationOwners: () => [],
    async handleFileChange() {
      coreStarted.release()
      await coreRelease.promise
      includeRestored = true
      return true
    },
  }
  const ctx = {
    autoRoutesService: service,
    scanService,
    runtimeState: {
      watcher: { sidecarWatcherMap: new Map() },
      build: { hmr: { resolvedEntryMap: new Map(), profile: {} } },
    },
    configService: {
      cwd: root,
      absoluteSrcRoot: srcRoot,
      isDev: true,
      relativeCwd: (file: string) => path.relative(root, file),
      weappViteConfig: { autoRoutes: true },
      packageInfo: { rootPath: path.resolve(import.meta.dirname, '../..') },
    },
  } as unknown as MutableCompilerContext
  try {
    await mkdir(path.dirname(restored), { recursive: true })
    await mkdir(path.join(srcRoot, 'pages/home'), { recursive: true })
    await writeFile(app, 'import "wevu/router/auto-routes"; App({})')
    await writeFile(path.join(srcRoot, 'app.json'), '{}')
    await writeFile(path.join(srcRoot, 'pages/home/index.js'), 'Page({})')
    await writeFile(restored, 'Page({})')
    const webPlugin = weappWebPlugin({
      __runtimeProvider: {
        moduleId: 'virtual:test-runtime',
        hmrAcceptCode: 'if (import.meta.hot) { import.meta.hot.accept() }',
      },
      async __resolveAppConfig() {
        if (!cachedConfig) {
          if (includeRestored) {
            webStarted.release()
            await webRelease.promise
          }
          cachedConfig = { pages: pages() }
        }
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
      server: { middlewareMode: true, watch: null, hmr: { port: 0 } },
      logLevel: 'silent',
    })
    expect(server.config.weappVite?.runtime).toBe('web')
    await server.transformRequest('/@weapp-vite/web/entry')
    await server.transformRequest('/src/app.js')
    await server.transformRequest('wevu/router/auto-routes')
    server.environments.client!.hot.send = ((payload: { type?: string }) => {
      if (payload.type === 'full-reload') {
        entriesAtReload.push(server!.transformRequest('/@weapp-vite/web/entry'))
        reloadSent.release()
      }
    }) as typeof server.environments.client.hot.send

    // Vite 可把删除后恢复的同一路径报告为 update；共享路由刷新先于 Web 快照消费。
    server.watcher.emit('change', restored)
    await coreStarted.promise
    coreRelease.release()
    try {
      expect(await Promise.race([
        webStarted.promise.then(() => 'web-snapshot'),
        reloadSent.promise.then(() => 'reload'),
      ])).toBe('web-snapshot')
      expect(entriesAtReload).toHaveLength(0)
    }
    finally {
      webRelease.release()
    }
    await reloadSent.promise
    expect(entriesAtReload).toHaveLength(1)
    expect((await entriesAtReload[0])?.code).toContain('/src/pages/restored/index.js')
  }
  finally {
    coreRelease.release()
    webRelease.release()
    await Promise.allSettled(entriesAtReload)
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})

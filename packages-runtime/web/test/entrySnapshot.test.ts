import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { describe, expect, it } from 'vitest'
import { weappWebPlugin } from '../src/plugin'
import { ENTRY_ID, RESOLVED_AUTO_ROUTES_ID } from '../src/plugin/constants'

function createBarrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('Web entry snapshot publication', () => {
  it('serves restored page entries and route ids from the pending complete scan', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-entry-snapshot-'))
    const srcRoot = join(root, 'src')
    const home = join(srcRoot, 'pages/home/index.js')
    const restored = join(srcRoot, 'pages/restored/index.js')
    const started = createBarrier()
    const blocked = createBarrier()
    let blockNext = false
    const config = { pages: ['pages/home/index', 'pages/restored/index'] }
    const plugin = weappWebPlugin({
      async __resolveAppConfig() {
        if (blockNext) {
          blockNext = false
          started.release()
          await blocked.promise
        }
        return config
      },
    })
    try {
      await mkdir(dirname(home), { recursive: true })
      await mkdir(dirname(restored), { recursive: true })
      await writeFile(join(srcRoot, 'app.js'), 'App({})')
      await writeFile(join(srcRoot, 'app.json'), JSON.stringify(config))
      await writeFile(home, 'Page({})')
      await writeFile(restored, 'Page({})')
      await plugin.configResolved!.call({}, { root, command: 'serve' })
      expect(await plugin.load!(ENTRY_ID)).toContain('pages/restored/index.js')

      await rm(restored)
      await plugin.watchChange!.handler.call({}, restored, { event: 'delete' })
      expect(await plugin.load!(ENTRY_ID)).not.toContain('pages/restored/index.js')

      await writeFile(restored, 'Page({})')
      blockNext = true
      const refreshing = plugin.watchChange!.handler.call({}, restored, { event: 'create' })
      try {
        await started.promise
        // 浏览器重载可以在文件扫描尚未发布时请求入口，两个拓扑模块必须共享同一轮完整结果。
        const entry = plugin.load!(ENTRY_ID)
        const routes = plugin.load!(RESOLVED_AUTO_ROUTES_ID)
        blocked.release()
        await refreshing
        expect(await entry).toContain('pages/restored/index.js')
        expect(await routes).toContain('pages/restored/index')
      }
      finally {
        blocked.release()
        await refreshing
      }
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('retires cached topology modules before a queued scan can race browser revalidation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-entry-cache-'))
    const srcRoot = join(root, 'src')
    const home = join(srcRoot, 'pages/home/index.js')
    const started = createBarrier()
    const blocked = createBarrier()
    let blockNext = false
    const plugin = weappWebPlugin({
      async __resolveAppConfig() {
        if (blockNext) {
          blockNext = false
          started.release()
          await blocked.promise
        }
        return { pages: ['pages/home/index'] }
      },
    })
    let server: Awaited<ReturnType<typeof createServer>> | undefined
    try {
      await mkdir(dirname(home), { recursive: true })
      await writeFile(join(srcRoot, 'app.js'), 'App({})')
      await writeFile(join(srcRoot, 'app.json'), '{}')
      await writeFile(home, 'Page({})')
      server = await createServer({
        root,
        configFile: false,
        plugins: [plugin],
        optimizeDeps: { noDiscovery: true },
        server: { hmr: false, middlewareMode: true, watch: null },
        logLevel: 'silent',
      })
      await server.transformRequest('/@weapp-vite/web/entry')
      await server.transformRequest('weapp-vite/auto-routes')
      const entryModule = server.environments.client!.moduleGraph.getModuleById(ENTRY_ID)!
      const routesModule = server.environments.client!.moduleGraph.getModuleById(RESOLVED_AUTO_ROUTES_ID)!
      expect(entryModule.transformResult).toBeTruthy()
      expect(routesModule.transformResult).toBeTruthy()

      blockNext = true
      const refreshing = plugin.handleHotUpdate!.call({}, { file: join(server.config.root, 'src/pages/home/index.js') })
      try {
        await started.promise
        // 已缓存的响应会绕过 load；扫描开始后必须先撤销旧 ETag/transform，再等待完整发布。
        expect(entryModule.transformResult).toBeNull()
        expect(routesModule.transformResult).toBeNull()
        const entry = server.transformRequest('/@weapp-vite/web/entry')
        const routes = server.transformRequest('weapp-vite/auto-routes')
        blocked.release()
        await refreshing
        expect((await entry)?.code).toContain('pages/home/index.js')
        expect((await routes)?.code).toContain('pages/home/index')
      }
      finally {
        blocked.release()
        await refreshing
      }
    }
    finally {
      await server?.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})

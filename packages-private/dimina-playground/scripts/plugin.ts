import type { Plugin, ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { root } from '../config'
import { assetContentType } from './assets'
import { compileResources } from './compile'
import { createRebuildScheduler } from './scheduler'

export function diminaResources(): Plugin {
  let assets = new Map<string, Buffer>()
  let base = '/'
  let server: ViteDevServer | undefined
  const scheduler = createRebuildScheduler(async () => {
    const next = await compileResources()
    assets = next
    server?.ws.send({ type: 'full-reload' })
  }, (error) => {
    const message = error instanceof Error ? error.message : String(error)
    server?.config.logger.error(message)
    server?.ws.send({ type: 'custom', event: 'dimina:error', data: { message } })
  })
  function importMap() {
    return JSON.stringify({ imports: { mitt: `${base}vendor/mitt.mjs` } })
  }
  function frame() {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}dimina-sdk/pageFrame.css"><script type="importmap">${importMap()}</script></head><body><script type="module" src="${base}dimina-sdk/pageFrame.js"></script></body></html>`
  }
  return {
    name: 'dimina-resources',
    configResolved(config) {
      base = config.base
    },
    async buildStart() {
      assets = await compileResources()
    },
    transformIndexHtml: { order: 'pre', handler: () => [{ tag: 'script', attrs: { type: 'importmap' }, children: importMap(), injectTo: 'head-prepend' }] },
    generateBundle() {
      for (const [fileName, source] of assets) {
        this.emitFile({ type: 'asset', fileName, source })
      }
      this.emitFile({ type: 'asset', fileName: 'pageFrame.html', source: frame() })
    },
    handleHotUpdate(context) {
      if (!path.relative(path.join(root, 'fixtures'), context.file).startsWith('..')) {
        return []
      }
    },
    configureServer(viteServer) {
      server = viteServer
      const fixtures = path.join(root, 'fixtures')
      server.watcher.add(fixtures)
      const changed = (file: string) => {
        const relative = path.relative(fixtures, file)
        if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('.weapp-vite')) {
          return
        }
        void scheduler.schedule()
      }
      server.watcher.on('add', changed).on('change', changed).on('unlink', changed)
      server.httpServer?.once('close', () => {
        server?.watcher.off('add', changed).off('change', changed).off('unlink', changed)
        void scheduler.close()
      })
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        const name = decodeURIComponent(pathname.startsWith(base) ? pathname.slice(base.length) : pathname.slice(1))
        const content = name === 'pageFrame.html' ? Buffer.from(frame()) : assets.get(name)
        if (!content) {
          if (/^(?:miniapps|dimina-sdk|vendor)\//.test(name)) {
            res.statusCode = 404
            res.end('Missing Dimina resource')
            return
          }
          next()
          return
        }
        res.setHeader('Content-Type', assetContentType(name))
        res.setHeader('Cache-Control', 'no-store')
        res.end(content)
      })
    },
  }
}

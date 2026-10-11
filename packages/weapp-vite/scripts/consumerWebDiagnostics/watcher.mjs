/** 仅注入隔离 consumer 配置，观察原事件，不改变文件、模块或 HMR 流程。 */
export const consumerWebWatcherDiagnosticSource = `
import diagnosticPath from 'node:path'
import { performance as diagnosticPerformance } from 'node:perf_hooks'
import diagnosticProcess from 'node:process'
import { fileURLToPath as diagnosticFileURLToPath } from 'node:url'

function consumerWebWatcherDiagnostics() {
  const root = diagnosticFileURLToPath(new URL('.', import.meta.url))
  const target = diagnosticPath.resolve(root, 'src/pages/index/index.vue')
  const label = 'src/pages/index/index.vue'
  let count = 0
  let cleanup = () => {}

  function record(kind, data = {}) {
    if (count > 96) return
    if (count++ === 96) {
      console.error('[web-consumer-server]', JSON.stringify({ kind: 'limit-reached', limit: 96 }))
      return
    }
    console.error('[web-consumer-server]', JSON.stringify({
      kind,
      at: new Date().toISOString(),
      monotonicMs: Number(diagnosticPerformance.now().toFixed(3)),
      timeOriginMs: diagnosticPerformance.timeOrigin,
      file: label,
      ...data,
    }))
  }

  function matches(file, details) {
    if (typeof file !== 'string') return false
    const normalize = value => diagnosticProcess.platform === 'win32' ? value.toLowerCase() : value
    if (normalize(diagnosticPath.resolve(root, file)) === normalize(target)) return true
    const watched = details?.watchedPath
    if (typeof watched !== 'string') return false
    if (normalize(diagnosticPath.resolve(watched, file)) === normalize(target)) return true
    return normalize(diagnosticPath.resolve(watched)) === normalize(target)
      && normalize(file) === normalize(diagnosticPath.basename(target))
  }

  function moduleLabel(id) {
    if (typeof id !== 'string') return '<no-id>'
    const clean = id.replaceAll(String.fromCharCode(0), '').split('?')[0]
    if (!diagnosticPath.isAbsolute(clean)) return clean.slice(0, 256)
    const relative = diagnosticPath.relative(root, clean).split(diagnosticPath.sep).join('/')
    return relative.startsWith('../') || diagnosticPath.isAbsolute(relative)
      ? '<outside-consumer>'
      : relative.slice(0, 256)
  }

  function observeHook(stage, context) {
    if (!matches(context.file)) return
    record('handleHotUpdate:' + stage, {
      timestamp: context.timestamp,
      moduleCount: context.modules.length,
      modules: context.modules.slice(0, 12).map(module => moduleLabel(module.id)),
    })
  }

  return [
    {
      name: 'consumer-web-observer-before',
      apply: 'serve',
      enforce: 'pre',
      configureServer(server) {
        const onRaw = (event, file, details) => {
          if (matches(file, details)) record('watcher:raw', { event: String(event).slice(0, 64) })
        }
        const onChange = (file) => {
          if (matches(file)) record('watcher:change')
        }
        let removed = false
        cleanup = () => {
          if (removed) return
          removed = true
          server.watcher.off('raw', onRaw)
          server.watcher.off('change', onChange)
          server.httpServer?.off('close', cleanup)
          record('listeners-removed')
        }
        server.watcher.on('raw', onRaw)
        server.watcher.on('change', onChange)
        server.httpServer?.once('close', cleanup)
        const options = server.watcher.options ?? {}
        const finish = options.awaitWriteFinish
        record('listeners-attached', { options: {
          usePolling: options.usePolling,
          useFsEvents: options.useFsEvents,
          interval: options.interval,
          atomic: options.atomic,
          awaitWriteFinish: Boolean(finish),
          stabilityThreshold: typeof finish === 'object' ? finish?.stabilityThreshold : undefined,
          pollInterval: typeof finish === 'object' ? finish?.pollInterval : undefined,
        } })
      },
      handleHotUpdate(context) {
        observeHook('before', context)
      },
      closeBundle() {
        cleanup()
      },
    },
    {
      name: 'consumer-web-observer-after',
      apply: 'serve',
      enforce: 'post',
      handleHotUpdate(context) {
        observeHook('after', context)
      },
    },
  ]
}
`

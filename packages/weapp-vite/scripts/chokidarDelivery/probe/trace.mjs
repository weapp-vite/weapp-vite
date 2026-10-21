import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const traceKey = Symbol.for('weapp-vite:delivery-probe-trace')

/** 测试专用时间轴跨 Vite 配置加载保持同一实例，不写入安装包或输出目录。 */
export function getDeliveryTrace(root) {
  const active = globalThis[traceKey]
  return active && path.relative(active.root, root) === '' ? active.trace : undefined
}

/** 只记录当前 consumer 的事件，保持 Error、返回值和事件派发顺序。 */
export function createDeliveryTrace(root, consumerRoot, injectedError) {
  const enabled = process.env.WEAPP_VITE_DELIVERY_TRACE === '1'
  const started = performance.now()
  const rows = []
  let sequence = 0
  let dropped = 0
  let batchSequence = 0
  let restoreChokidar
  const previous = globalThis[traceKey]
  const trace = {
    enabled,
    matchesRoot(file) {
      return path.relative(root, file) === ''
    },
    file(file) {
      if (file === undefined || file === null) {
        return undefined
      }
      const relative = path.relative(root, path.resolve(root, String(file))).replaceAll('\\', '/')
      return relative.startsWith('../') || path.isAbsolute(relative) ? '<outside-fixture>' : relative
    },
    error(error) {
      return { name: error?.name, code: error?.code, message: String(error), originalInjectedError: error === injectedError }
    },
    record(stage, details = {}) {
      if (!enabled) {
        return
      }
      const seq = ++sequence
      if (rows.length >= 20_000) {
        dropped++
        return
      }
      rows.push({ seq, elapsedMs: performance.now() - started, stage, ...details })
    },
    beginBatch(watchMode) {
      const batch = ++batchSequence
      trace.record('build.start', { batch, watchMode })
      return batch
    },
    async installChokidar() {
      if (!enabled) {
        return
      }
      const consumerRequire = createRequire(path.join(consumerRoot, 'package.json'))
      const compilerRequire = createRequire(consumerRequire.resolve('weapp-vite/package.json'))
      const entry = compilerRequire.resolve('chokidar')
      const { FSWatcher } = await import(pathToFileURL(entry).href)
      const prototype = FSWatcher.prototype
      const originalEmit = prototype.emit
      const originalEmitDescriptor = Object.getOwnPropertyDescriptor(prototype, 'emit')
      const watchers = new WeakMap()
      let watcherSequence = 0
      const observed = new Set(['add', 'change', 'unlink', 'addDir', 'unlinkDir', 'ready', 'error'])
      const emit = function (event, ...args) {
        if (observed.has(event)) {
          const file = event === 'error' ? args[0]?.path : typeof args[0] === 'string' ? args[0] : undefined
          const relative = trace.file(file)
          if (relative !== '<outside-fixture>') {
            let watcher = watchers.get(this)
            if (!watcher) {
              watchers.set(this, watcher = ++watcherSequence)
            }
            trace.record('chokidar.emit', {
              watcher,
              event,
              file: relative,
              listenerCount: this.listenerCount(event),
              ...(event === 'error' ? { error: trace.error(args[0]) } : {}),
            })
          }
        }
        return originalEmit.call(this, event, ...args)
      }
      prototype.emit = emit
      restoreChokidar = () => {
        const owned = prototype.emit === emit
        if (owned) {
          if (originalEmitDescriptor) {
            Object.defineProperty(prototype, 'emit', originalEmitDescriptor)
          }
          else {
            delete prototype.emit
          }
        }
        trace.record('trace.chokidar-restored', { owned })
      }
      trace.record('trace.chokidar-installed', { entry: path.relative(path.join(consumerRoot, 'node_modules'), entry).replaceAll('\\', '/') })
    },
    restore() {
      restoreChokidar?.()
      if (globalThis[traceKey]?.trace === trace) {
        if (previous === undefined) {
          delete globalThis[traceKey]
        }
        else {
          globalThis[traceKey] = previous
        }
      }
    },
    snapshot() {
      return { schemaVersion: 1, enabled, recorded: rows.length, dropped, rows }
    },
  }
  if (enabled) {
    globalThis[traceKey] = { root, trace }
  }
  return trace
}

/** 自包含工厂可内联进原 fixture 配置，避免新增被监听的配置依赖。 */
export function deliveryBuildTracePlugin(root) {
  const active = globalThis[Symbol.for('weapp-vite:delivery-probe-trace')]
  const trace = active?.trace?.matchesRoot(root) ? active.trace : undefined
  let batch
  const snapshot = (bundle) => {
    const outputs = Object.keys(bundle).sort()
    const marker = Object.values(bundle).find(item => item.fileName?.replaceAll('\\', '/') === 'reborn/marker.txt')
    return { outputs, markerEmitted: Boolean(marker), markerType: marker?.type }
  }
  return {
    name: 'consumer:delivery-trace',
    enforce: 'post',
    watchChange(file, change) {
      trace?.record('compiler.watchChange', { file: trace.file(file), event: change?.event, watchMode: this.meta.watchMode })
    },
    buildStart() {
      batch = trace?.beginBatch(this.meta.watchMode)
    },
    buildEnd(error) {
      trace?.record('build.end', { batch, ...(error ? { error: trace.error(error) } : {}) })
    },
    generateBundle(_options, bundle) {
      trace?.record('build.generated', { batch, ...snapshot(bundle) })
    },
    writeBundle(options, bundle) {
      trace?.record('build.written', { batch, outDir: trace.file(options.dir), ...snapshot(bundle) })
    },
    closeBundle() {
      trace?.record('build.closed', { batch })
    },
  }
}

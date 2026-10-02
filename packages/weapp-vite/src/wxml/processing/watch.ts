import type { FSWatcher } from 'chokidar'
import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import type { DevModuleGraphChange } from '../../moduleGraph/devProvider'
import { once } from 'node:events'
import { watch } from 'chokidar'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { observeWxmlDependencies } from './dependencies'

type WatchContext = Pick<CompilerContext, 'runtimeState'> & Partial<Pick<CompilerContext, 'configService'>>
const externalOwners = new WeakMap<WatchContext, Set<string>>()

export function ownsExternalWxmlWatch(ctx: WatchContext, file: string) {
  return externalOwners.get(ctx)?.has(normalizeFsResolvedId(file)) ?? false
}

/** 根外输入按父目录浅层监听，保留删除后的路径身份；根内输入继续由 Vite 监听。 */
export function bindWxmlDependencyWatch(ctx: WatchContext, server: ViteDevServer, onChange: (change: DevModuleGraphChange) => void) {
  const root = server.config?.root ?? ctx.configService?.cwd
  const external = new Set<string>()
  const parents = new Set<string>()
  let watcher: FSWatcher | undefined
  let closed: Promise<void> | undefined
  let ready: Promise<unknown> = Promise.resolve()
  externalOwners.set(ctx, external)
  const unobserve = observeWxmlDependencies(ctx, (files) => {
    external.clear()
    const internal: string[] = []
    for (const file of files) {
      const relative = root ? path.relative(root, file) : ''
      if (root && (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative))) {
        external.add(file)
      }
      else {
        internal.push(file)
      }
    }
    server.watcher.add(internal)
    if (!external.size || server.config?.server.watch === null) {
      return
    }
    const options = server.config?.server.watch ?? {}
    if (!watcher) {
      watcher = watch([], {
        ...options,
        ignoreInitial: true,
        depth: 0,
        // 只观察已登记文件和直接父目录，不递归扫描根外目录或把兄弟文件变成输入。
        ignored: [
          ...(Array.isArray(options.ignored) ? options.ignored : options.ignored ? [options.ignored] : []),
          file => !external.has(normalizeFsResolvedId(file)) && !parents.has(normalizeFsResolvedId(file)),
        ],
      }).on('all', (event, file) => {
        const normalized = normalizeFsResolvedId(file)
        if (!external.has(normalized)) {
          return
        }
        if (event === 'add' || event === 'change' || event === 'unlink') {
          onChange({ event: event === 'add' ? 'create' : event === 'unlink' ? 'delete' : 'update', file: normalized })
        }
      }).on('error', error => server.config.logger.error(`[weapp-vite] WXML dependency watch failed: ${error instanceof Error ? error.message : String(error)}`))
      ready = once(watcher, 'ready')
    }
    for (const file of external) {
      const parent = path.dirname(file)
      if (!parents.has(parent)) {
        parents.add(parent)
        watcher.add(parent)
      }
    }
  })
  const close = () => {
    closed ??= (async () => {
      unobserve()
      if (externalOwners.get(ctx) === external) {
        externalOwners.delete(ctx)
      }
      external.clear()
      await watcher?.close()
    })()
    return closed
  }
  return Object.assign(close, { ready })
}

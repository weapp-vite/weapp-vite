import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import type { DevModuleGraphChange } from '../../moduleGraph/devProvider'
import path from 'pathe'
import { createFileWatcher } from '../../runtime/watch/fileWatcher'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { isWxmlDependency, observeWxmlDependencies } from './dependencies'

type WatchContext = Pick<CompilerContext, 'runtimeState'> & Partial<Pick<CompilerContext, 'configService'>>
const externalOwners = new WeakMap<WatchContext, Set<string>>()

export function ownsExternalWxmlWatch(ctx: WatchContext, file: string) {
  const normalized = normalizeFsResolvedId(file)
  return (externalOwners.get(ctx)?.has(normalized) ?? false) && isWxmlDependency(ctx, normalized)
}

/** 根外输入按父目录浅层监听，保留删除后的路径身份；根内输入继续由 Vite 监听。 */
export function bindWxmlDependencyWatch(ctx: WatchContext, server: ViteDevServer, onChange: (change: DevModuleGraphChange) => void) {
  const root = server.config?.root ?? ctx.configService?.cwd
  const external = new Set<string>()
  const parents = new Set<string>()
  let watcher: ReturnType<typeof createFileWatcher> | undefined
  let closed: Promise<void> | undefined
  let ready: Promise<'ready' | 'closed'> = Promise.resolve('ready')
  const reportError = (error: unknown) => server.config.logger.error(`[weapp-vite] WXML dependency watch failed: ${error instanceof Error ? error.message : String(error)}`)
  externalOwners.set(ctx, external)
  const releaseOwnership = () => {
    if (externalOwners.get(ctx) === external) {
      externalOwners.delete(ctx)
    }
    external.clear()
  }
  const observeDependencies = (files: string[]) => {
    // 初始通知是快照，后续通知仅包含新增路径；有效性始终以引用账本为准。
    for (const file of files) {
      const relative = root ? path.relative(root, file) : ''
      if (root && (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative))) {
        external.add(file)
      }
    }
    // 根内输入已由 Vite 递归观察；重复 add 会留下 close 后仍在运行的异步注册。
    if (!external.size || server.config?.server.watch === null) {
      return
    }
    const options = server.config?.server.watch ?? {}
    const writeFinish = options.awaitWriteFinish
    const additions: string[] = []
    for (const file of external) {
      const parent = path.dirname(file)
      if (!parents.has(parent)) {
        parents.add(parent)
        additions.push(parent)
      }
    }
    if (!watcher) {
      watcher = createFileWatcher({
        inlineConfig: {
          ...ctx.configService?.inlineConfig,
          server: { watch: options },
        },
      }, [...parents], {
        persistent: options.persistent,
        atomic: options.atomic,
        stability: writeFinish
          ? {
              threshold: typeof writeFinish === 'object' ? writeFinish.stabilityThreshold ?? 2000 : 2000,
              interval: typeof writeFinish === 'object' ? writeFinish.pollInterval ?? 100 : 100,
            }
          : undefined,
        ignoreInitial: true,
        depth: 0,
        // 提前安装同层文件监听，避免后登记的现存兄弟文件在首次保存前仍未被订阅。
        // 兄弟文件仅是物理监听对象，只有引用账本中的精确路径才会触发重建。
        ignored: [
          ...(Array.isArray(options.ignored) ? options.ignored : options.ignored ? [options.ignored] : []),
          (file, stats) => {
            const normalized = normalizeFsResolvedId(file)
            return !parents.has(normalized)
              && (!parents.has(path.dirname(normalized)) || Boolean(stats?.isDirectory()))
          },
        ],
      })
      watcher.onChange((changes) => {
        for (const change of changes) {
          const normalized = normalizeFsResolvedId(change.file)
          if (change.kind === 'file' && external.has(normalized) && isWxmlDependency(ctx, normalized)) {
            onChange({ event: change.event, file: normalized })
          }
        }
      })
      watcher.onError(reportError)
      ready = watcher.ready
    }
    else if (additions.length) {
      void watcher.add(additions).catch(reportError)
    }
  }
  let unobserve: () => void
  try {
    unobserve = observeWxmlDependencies(ctx, observeDependencies)
  }
  catch (error) {
    releaseOwnership()
    throw error
  }
  const close = () => {
    closed ??= (async () => {
      unobserve()
      releaseOwnership()
      await watcher?.close()
    })()
    return closed
  }
  return Object.assign(close, { ready })
}

import type { BuildTarget, CompilerContext } from '../../context'
import type { PublicAssetOptions } from '../../plugins/asset/publicSources'
import type { ChangeEvent } from '../../types'
import { existsSync } from 'node:fs'
import path from 'pathe'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { createAssetSourcePlan } from '../../plugins/asset/sources'
import { normalizePath } from '../../utils/path'
import { createFileWatcher } from './fileWatcher'

interface AssetWatchOptions {
  target?: BuildTarget
  publicAssets?: PublicAssetOptions
  isModule?: (file: string) => boolean
  onChange: (file: string, event: ChangeEvent) => void
  onError: (error: Error) => void
}

/** 复制资产由过滤后的侧车发现，不把整个目录登记为原生引擎隐式依赖。 */
export function watchAssetSources(config: CompilerContext['configService'], options: AssetWatchOptions) {
  const copied = createAssetSourcePlan(config, config.outDir, options.target ?? 'app')
  const publicAssets = createPublicAssetSourcePlan(options.publicAssets, config.outDir)
  const plan = {
    roots: [...new Set([...copied.roots, ...publicAssets.roots])],
    matchesPath: (file: string) => copied.matchesPath(file) || publicAssets.matchesPath(file),
    ignoresDirectory: (file: string) => copied.ignoresDirectory(file) && !publicAssets.matchesPath(file),
    scan: async () => [...new Set([...(await copied.scan()), ...(await publicAssets.scan())])],
  }
  const contains = (root: string, file: string) => {
    const relative = path.relative(root, file)
    return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
  }
  const watchRoots = plan.roots.map((root) => {
    let parent = path.dirname(root)
    while (!existsSync(parent) && path.dirname(parent) !== parent) {
      parent = path.dirname(parent)
    }
    return parent
  })
  let watched = new Set<string>()
  let pending = Promise.resolve()
  let initialized = false
  let closed = false
  let closing: Promise<void> | undefined
  const closingFailures = new Set<unknown>()
  const ready = Promise.withResolvers<'ready' | 'closed'>()
  const fail = (error: unknown) => {
    const failure = error instanceof Error ? error : new Error(String(error))
    if (closed) {
      closingFailures.add(failure)
    }
    else if (!initialized) {
      ready.reject(failure)
    }
    else {
      options.onError(failure)
    }
  }
  const watcher = createFileWatcher(config, watchRoots, {
    persistent: true,
    ignoreInitial: false,
    ignored(file, stats) {
      if (!plan.roots.some(root => contains(root, file) || contains(file, root))) {
        return true
      }
      // filter 可以依赖内容或文件是否存在；不能用它从 watcher 永久移除路径。
      return stats?.isFile() === true ? !plan.matchesPath(file) : plan.ignoresDirectory(file)
    },
  })
  watcher.onChange((changes) => {
    if (closed || !initialized) {
      return
    }
    const changedFiles = new Map<string, ChangeEvent>()
    for (const change of changes) {
      if (change.kind === 'file') {
        changedFiles.set(normalizePath(change.file), change.event)
      }
    }
    if (!changedFiles.size) {
      return
    }
    pending = pending.then(async () => {
      if (closed) {
        return
      }
      // filter 的 index/array 也是公开契约；每批只做一次完整扫描，统一计算最终归属。
      const next = new Set(await plan.scan())
      if (closed) {
        return
      }
      const changed = new Map<string, ChangeEvent>()
      for (const previous of watched) {
        if (!next.has(previous)) {
          changed.set(previous, 'delete')
        }
      }
      for (const current of next) {
        if (!watched.has(current)) {
          changed.set(current, 'create')
        }
      }
      for (const [file, event] of changedFiles) {
        if (watched.has(file) && next.has(file)) {
          changed.set(file, event === 'create' ? 'create' : 'update')
        }
      }
      watched = next
      for (const [file, event] of changed) {
        if (publicAssets.matchesPath(file) || !options.isModule?.(file)) {
          options.onChange(file, event)
        }
      }
    }).catch(fail)
  })
  void watcher.ready.then((state) => {
    if (closed || state === 'closed') {
      ready.resolve('closed')
      return
    }
    initialized = true
    pending = pending.then(async () => {
      watched = new Set(await plan.scan())
      ready.resolve(closed ? 'closed' : 'ready')
    }).catch((error) => {
      ready.reject(error)
      fail(error)
    })
  }, fail)
  watcher.onError(fail)
  return {
    ready: ready.promise,
    close() {
      if (!closing) {
        closed = true
        ready.resolve('closed')
        closing = (async () => {
          const results = await Promise.allSettled([watcher.close(), pending])
          for (const result of results) {
            if (result.status === 'rejected') {
              closingFailures.add(result.reason)
            }
          }
          watched.clear()
          if (closingFailures.size) {
            const errors = [...closingFailures]
            throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Asset watcher cleanup failed', { cause: errors[0] })
          }
        })()
      }
      return closing
    },
  }
}

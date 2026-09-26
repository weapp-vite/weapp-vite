import type { BuildTarget, CompilerContext } from '../../context'
import type { PublicAssetOptions } from '../../plugins/asset/publicSources'
import type { ChangeEvent } from '../../types'
import { existsSync } from 'node:fs'
import chokidar from 'chokidar'
import path from 'pathe'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { createAssetSourcePlan } from '../../plugins/asset/sources'
import { normalizePath } from '../../utils/path'
import { createSidecarWatchOptions } from './options'

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
  const ready = Promise.withResolvers<void>()
  const fail = (error: unknown) => {
    const failure = error instanceof Error ? error : new Error(String(error))
    if (!initialized) {
      ready.reject(failure)
    }
    else if (!closed) {
      options.onError(failure)
    }
  }
  const watcher = chokidar.watch(watchRoots, createSidecarWatchOptions(config, {
    persistent: true,
    ignoreInitial: false,
    ignored(file, stats) {
      if (!plan.roots.some(root => contains(root, file) || contains(file, root))) {
        return true
      }
      // filter 可以依赖内容或文件是否存在；不能用它从 watcher 永久移除路径。
      return stats?.isFile() === true ? !plan.matchesPath(file) : plan.ignoresDirectory(file)
    },
  }))
  watcher.on('all', (event, changedFile) => {
    const file = normalizePath(changedFile)
    if (closed || !initialized || !['add', 'change', 'unlink'].includes(event)) {
      return
    }
    pending = pending.then(async () => {
      if (closed) {
        return
      }
      // filter 的 index/array 也是公开契约；按与构建相同的完整扫描计算，不能单独过滤事件文件。
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
      if (watched.has(file) && next.has(file)) {
        changed.set(file, event === 'add' ? 'create' : 'update')
      }
      watched = next
      for (const [file, event] of changed) {
        if (publicAssets.matchesPath(file) || !options.isModule?.(file)) {
          options.onChange(file, event)
        }
      }
    }).catch(fail)
  })
  watcher.once('ready', () => {
    initialized = true
    pending = pending.then(async () => {
      watched = new Set(await plan.scan())
      ready.resolve()
    }).catch((error) => {
      ready.reject(error)
      fail(error)
    })
  })
  watcher.on('error', fail)
  return {
    ready: ready.promise,
    async close() {
      closed = true
      ready.resolve()
      await watcher.close()
      await pending
      watched.clear()
    },
  }
}

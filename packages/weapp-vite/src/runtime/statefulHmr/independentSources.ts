import type { ViteDevServer } from 'vite'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export interface IndependentSources {
  files: string[]
  roots: string[]
}

/** 独立目标不属于主 DevEngine 模块图，复用宿主 watcher 请求完整批次。 */
export function observeIndependentSources(server: ViteDevServer, update: (file: string) => void) {
  let files = new Set<string>()
  let roots: string[] = []
  const owns = (file: string) => {
    const normalized = normalizeFsResolvedId(file)
    return files.has(normalized) || roots.some(root => normalized === root || normalized.startsWith(`${root}/`))
  }
  const onChange = (event: string, file: string) => {
    if (['add', 'change', 'unlink'].includes(event) && owns(file)) {
      update(normalizeFsResolvedId(file))
    }
  }
  server.watcher.on('all', onChange)
  return {
    owns,
    adopt(sources?: IndependentSources) {
      files = new Set(sources?.files.map(file => normalizeFsResolvedId(file)))
      roots = sources?.roots.map(root => normalizeFsResolvedId(root).replace(/\/$/, '')) ?? []
      server.watcher.add([...files, ...roots])
    },
    close() {
      // watcher 属于宿主；这里只释放本会话的订阅，不 unwatch 其他插件可能使用的文件。
      server.watcher.off('all', onChange)
      files.clear()
      roots = []
    },
  }
}

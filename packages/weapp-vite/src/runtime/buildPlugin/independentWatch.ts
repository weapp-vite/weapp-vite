import type { Plugin } from 'vite'
import { parseLogicalEntryId, parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../utils/resolvedId'

type IndependentWatchRegistry = Map<string, Set<string>>
const registryEpochs = new WeakMap<IndependentWatchRegistry, number>()

/** 关闭后使在途子构建的旧回调失效；同一上下文的新构建仍可重新登记。 */
export function clearIndependentWatchFiles(registry: IndependentWatchRegistry) {
  registryEpochs.set(registry, (registryEpochs.get(registry) ?? 0) + 1)
  registry.clear()
}

/** 子构建只收集依赖，由主构建现有的监听器和调度器统一处理。 */
export function collectIndependentWatchFiles(registry: IndependentWatchRegistry, root: string, dependencies: (source: string) => Iterable<string> = () => [], listeners: Set<(files: string[]) => void> = new Set()) {
  const epoch = registryEpochs.get(registry) ?? 0
  const active = () => epoch === (registryEpochs.get(registry) ?? 0)
  const files = new Set<string>()
  const previous = registry.get(root) ?? new Set<string>()
  const capture = (ids: Iterable<string>) => {
    if (!active()) {
      return
    }
    const added: string[] = []
    for (const moduleId of ids) {
      const source = parseLogicalEntryId(moduleId)?.sourceId ?? parseSidecarModuleId(moduleId)?.sourceId ?? parseSidecarSourceRequest(moduleId)?.sourceId ?? moduleId
      for (const id of [source, ...dependencies(source)]) {
        if (!isSkippableResolvedId(id)) {
          const file = normalizeFsResolvedId(id).split('?')[0]!
          files.add(file)
          if (!previous.has(file)) {
            previous.add(file)
            added.push(file)
          }
        }
      }
    }
    // 失败也保留新增依赖，修改或恢复文件后可以重试。
    registry.set(root, previous)
    if (added.length) {
      for (const listener of listeners) {
        listener(added)
      }
    }
  }
  return {
    plugin: {
      name: 'weapp-vite:independent-watch-dependencies',
      enforce: 'post',
      buildEnd() {
        capture(this.getModuleIds())
      },
      generateBundle: {
        order: 'post',
        handler() {
          capture(this.getModuleIds())
        },
      },
    } satisfies Plugin,
    commit() {
      if (active()) {
        registry.set(root, files)
      }
    },
  }
}

import type { PluginContext } from 'rolldown'
import { normalizeWatchPath } from '../../utils/path'

export function addModulesHot(entriesSet: Set<string>, pluginContext: PluginContext) {
  for (const entry of entriesSet) {
    const moduleInfo = pluginContext.getModuleInfo(entry)

    if (moduleInfo) {
      const stack = [moduleInfo.id] // 用栈模拟递归
      const visitedModules = new Set<string>()

      while (stack.length > 0) {
        const id = stack.pop()

        if (id && !visitedModules.has(id)) {
          visitedModules.add(id)

          const info = pluginContext.getModuleInfo(id)

          if (info) {
            pluginContext.addWatchFile(normalizeWatchPath(info.id))
            // 将子依赖加入栈
            stack.push(...info.importedIds)
          }
        }
      }
    }
  }
}

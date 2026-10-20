import type { CompilerContext } from '../../context'
import { isTemplate } from '../../utils'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 收集当前模板图中的传递依赖，不继承上一轮已经移除的边。 */
export function collectTemplateDependencySources(
  wxmlService: CompilerContext['wxmlService'] | undefined,
  templatePath?: string,
) {
  const sources = { template: new Set<string>(), wxs: new Set<string>() }
  if (!templatePath) {
    return sources
  }
  const visited = new Set([normalizeFsResolvedId(templatePath)])
  const pending = [templatePath]
  while (pending.length) {
    const template = pending.pop()!
    for (const dependency of wxmlService?.depsMap?.get(template) ?? []) {
      const sourceId = normalizeFsResolvedId(dependency)
      if (visited.has(sourceId)) {
        continue
      }
      visited.add(sourceId)
      if (isTemplate(sourceId)) {
        sources.template.add(sourceId)
        pending.push(sourceId)
      }
      else {
        sources.wxs.add(sourceId)
      }
    }
  }
  return sources
}

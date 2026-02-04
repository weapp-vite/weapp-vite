import type { OutputChunk } from 'rolldown'

/**
 * 从 `fileName` 起遍历 chunk 图并收集所有引用的模块 id。
 * Rolldown 在 `inlineDynamicImports` 为 true 时会内联动态导入，
 * 因此只需要遍历已输出的 chunk。
 */
export function collectReferencedModules(
  bundle: Record<string, OutputChunk>,
  fileName: string,
  allModules: Set<string>,
  analyzedModules = new Set<string>(),
) {
  if (analyzedModules.has(fileName)) {
    return
  }
  analyzedModules.add(fileName)

  const chunk = bundle[fileName]
  if (!chunk) {
    return
  }
  for (const mod of chunk.moduleIds) {
    allModules.add(mod)
  }
  for (const imported of chunk.imports) {
    collectReferencedModules(bundle, imported, allModules, analyzedModules)
  }
  for (const imported of chunk.dynamicImports) {
    collectReferencedModules(bundle, imported, allModules, analyzedModules)
  }
}

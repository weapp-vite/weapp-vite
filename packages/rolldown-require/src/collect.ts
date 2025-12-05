import type { OutputChunk } from 'rolldown'

/**
 * Walk the chunk graph starting from `fileName` and collect every referenced module id.
 * Rolldown inlines dynamic imports when `inlineDynamicImports` is true, so we only need to
 * traverse the emitted chunks.
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

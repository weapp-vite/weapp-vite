import type { CompilerContext } from '../../../context'
import { get, isObject, set } from '@weapp-core/shared'

export function createAutoImportAugmenter(
  autoImportService: CompilerContext['autoImportService'],
  wxmlService: CompilerContext['wxmlService'],
  externalComponentEntryMap?: Map<string, string>,
) {
  const cache = new Map<string, {
    hit: Record<string, unknown>
    version: number
    resolvedComponents: Record<string, { from: string, resolvedId?: string }>
  }>()

  return function applyAutoImports(baseName: string, json: any) {
    const hit = wxmlService.getAggregatedAutoImportComponents?.(baseName)
      ?? wxmlService.getAggregatedComponents(baseName)
    if (!hit) {
      return []
    }

    const version = autoImportService.getVersion()
    const cached = cache.get(baseName)
    const resolvedComponents = cached && cached.hit === hit && cached.version === version
      ? cached.resolvedComponents
      : (() => {
          const resolvedComponents: Record<string, { from: string, resolvedId?: string }> = {}
          for (const depComponentName of Object.keys(hit)) {
            const match = autoImportService.resolve(depComponentName, baseName)
            if (!match) {
              continue
            }

            resolvedComponents[match.value.name] = {
              from: match.value.from,
              resolvedId: match.value.resolvedId,
            }
          }
          cache.set(baseName, {
            hit,
            version,
            resolvedComponents,
          })
          return resolvedComponents
        })()

    const injectedEntries: string[] = []
    for (const [name, resolved] of Object.entries(resolvedComponents)) {
      const usingComponents = get(json, 'usingComponents')
      if (isObject(usingComponents) && Reflect.has(usingComponents, name)) {
        if (usingComponents[name] === resolved.from) {
          injectedEntries.push(resolved.from)
        }
        continue
      }

      set(json, `usingComponents.${name}`, resolved.from)
      injectedEntries.push(resolved.from)
      if (resolved.resolvedId) {
        externalComponentEntryMap?.set(resolved.from.replace(/^\/+/, ''), resolved.resolvedId)
      }
    }

    return injectedEntries
  }
}

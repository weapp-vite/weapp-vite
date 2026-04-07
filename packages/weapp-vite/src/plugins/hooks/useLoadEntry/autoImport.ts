import type { CompilerContext } from '../../../context'
import { get, isObject, set } from '@weapp-core/shared'

export function createAutoImportAugmenter(
  autoImportService: CompilerContext['autoImportService'],
  wxmlService: CompilerContext['wxmlService'],
) {
  const cache = new Map<string, {
    hit: Record<string, unknown>
    version: number
    usingComponents: Record<string, string>
  }>()

  return function applyAutoImports(baseName: string, json: any) {
    const hit = wxmlService.getAggregatedComponents(baseName)
    if (!hit) {
      return
    }

    const version = autoImportService.getVersion()
    const cached = cache.get(baseName)
    const resolvedUsingComponents = cached && cached.hit === hit && cached.version === version
      ? cached.usingComponents
      : (() => {
          const usingComponents: Record<string, string> = {}
          for (const depComponentName of Object.keys(hit)) {
            const match = autoImportService.resolve(depComponentName, baseName)
            if (!match) {
              continue
            }

            usingComponents[match.value.name] = match.value.from
          }
          cache.set(baseName, {
            hit,
            version,
            usingComponents,
          })
          return usingComponents
        })()

    for (const [name, from] of Object.entries(resolvedUsingComponents)) {
      const usingComponents = get(json, 'usingComponents')
      if (isObject(usingComponents) && Reflect.has(usingComponents, name)) {
        continue
      }

      set(json, `usingComponents.${name}`, from)
    }
  }
}

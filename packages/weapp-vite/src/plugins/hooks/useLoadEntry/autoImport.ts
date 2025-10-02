import type { CompilerContext } from '../../../context'
import { get, isObject, set } from '@weapp-core/shared'

export function createAutoImportAugmenter(
  autoImportService: CompilerContext['autoImportService'],
  wxmlService: CompilerContext['wxmlService'],
) {
  return function applyAutoImports(baseName: string, json: any) {
    const hit = wxmlService.wxmlComponentsMap.get(baseName)
    if (!hit) {
      return
    }

    const depComponentNames = Object.keys(hit)
    for (const depComponentName of depComponentNames) {
      const match = autoImportService.resolve(depComponentName, baseName)
      if (!match) {
        continue
      }

      const { value } = match
      const usingComponents = get(json, 'usingComponents')
      if (isObject(usingComponents) && Reflect.has(usingComponents, value.name)) {
        continue
      }

      set(json, `usingComponents.${value.name}`, value.from)
    }
  }
}

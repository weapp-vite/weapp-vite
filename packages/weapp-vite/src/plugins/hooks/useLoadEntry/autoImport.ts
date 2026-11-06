import type { ResolvedValue } from '../../../auto-import-components/resolvers/types'
import type { CompilerContext } from '../../../context'
import type { AutoImportMatch } from '../../../runtime/autoImport/service/types'
import { get, isObject, set } from '@weapp-core/shared'
import { createLocalCandidateRegistrar } from './autoImport/localCandidates'

export interface ResolvedAutoImportComponent extends Pick<ResolvedValue, 'from' | 'resolvedId' | 'sourceType'> {
  kind: AutoImportMatch['kind']
}
type ResolvedAutoImportComponents = Record<string, ResolvedAutoImportComponent>

export function createAutoImportAugmenter(
  autoImportService: CompilerContext['autoImportService'],
  wxmlService: CompilerContext['wxmlService'],
  externalComponentEntryMap?: Map<string, string>,
  configService?: CompilerContext['configService'],
) {
  let cache = new Map<string, {
    hit: Record<string, unknown>
    version: number
    resolvedComponents: ResolvedAutoImportComponents
  }>()
  const localCandidates = createLocalCandidateRegistrar(autoImportService, configService)

  function injectResolvedComponents(
    json: any,
    resolvedComponents: ResolvedAutoImportComponents,
  ) {
    const injectedEntries: ResolvedAutoImportComponent[] = []
    for (const [name, resolved] of Object.entries(resolvedComponents)) {
      const trackResolvedId = () => {
        if (resolved.resolvedId) {
          externalComponentEntryMap?.set(resolved.from.replace(/^\/+/, ''), resolved.resolvedId)
        }
      }
      const usingComponents = get(json, 'usingComponents')
      if (isObject(usingComponents) && Reflect.has(usingComponents, name)) {
        if (usingComponents[name] === resolved.from) {
          trackResolvedId()
          injectedEntries.push({ ...resolved })
        }
        continue
      }

      set(json, `usingComponents.${name}`, resolved.from)
      injectedEntries.push({ ...resolved })
      trackResolvedId()
    }
    return injectedEntries
  }

  function applyAutoImports(baseName: string, json: any, retryMissing = true): ResolvedAutoImportComponent[] | Promise<ResolvedAutoImportComponent[]> {
    const currentCache = cache
    const hit = wxmlService.getAggregatedAutoImportComponents?.(baseName)
      ?? wxmlService.getAggregatedComponents(baseName)
    if (!hit) {
      return []
    }

    const version = autoImportService.getVersion()
    const cached = currentCache.get(baseName)
    if (cached && cached.hit === hit && cached.version === version) {
      return injectResolvedComponents(json, cached.resolvedComponents)
    }

    const resolvedComponents: ResolvedAutoImportComponents = {}
    const missingComponentNames: string[] = []
    for (const depComponentName of Object.keys(hit)) {
      const match = autoImportService.resolve(depComponentName, baseName)
      if (!match) {
        missingComponentNames.push(depComponentName)
        continue
      }

      resolvedComponents[match.value.name] = {
        kind: match.kind,
        from: match.value.from,
        resolvedId: match.value.resolvedId,
        sourceType: match.value.sourceType,
      }
    }
    if (
      missingComponentNames.length
      && retryMissing
      && configService
      && typeof autoImportService.registerPotentialComponent === 'function'
    ) {
      return localCandidates.register(missingComponentNames).then((registered) => {
        if (!registered) {
          currentCache.set(baseName, { hit, version, resolvedComponents })
          return injectResolvedComponents(json, resolvedComponents)
        }
        return applyAutoImports(baseName, json, false)
      })
    }

    currentCache.set(baseName, { hit, version, resolvedComponents })
    return injectResolvedComponents(json, resolvedComponents)
  }

  return Object.assign(applyAutoImports, {
    invalidateLocalCandidates() {
      localCandidates.clear()
      cache = new Map()
    },
  })
}

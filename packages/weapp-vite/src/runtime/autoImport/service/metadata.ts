import type { Resolver } from '../../../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../../../context'
import type { ComponentMetadata } from '../metadata'
import type { LocalAutoImportMatch } from '../types'
import fs from 'fs-extra'
import path from 'pathe'
import { logger } from '../../../context/shared'
import { getAutoImportConfig } from '../config'
import { loadExternalComponentMetadata } from '../externalMetadata'
import { extractJsonPropMetadata } from '../metadata'

export interface MetadataHelpers {
  getComponentMetadata: (name: string) => ComponentMetadata
  preloadResolverComponentMetadata: () => void
}

interface MetadataState {
  ctx: MutableCompilerContext
  registry: Map<string, LocalAutoImportMatch>
  componentMetadataMap: Map<string, ComponentMetadata>
  resolverComponentNames: Set<string>
  resolverComponentsMapRef: { value: Record<string, string> }
  manifestCache: Map<string, string>
  collectResolverComponents: () => Record<string, string>
}

export function createMetadataHelpers(state: MetadataState): MetadataHelpers {
  function getComponentMetadata(name: string): ComponentMetadata {
    if (state.resolverComponentNames.has(name)) {
      const existing = state.componentMetadataMap.get(name)
      if (existing && existing.types.size > 0) {
        return {
          types: new Map(existing.types),
          docs: new Map(existing.docs),
        }
      }

      const from = state.resolverComponentsMapRef.value[name]
      const cwd = state.ctx.configService?.cwd
      if (from && cwd) {
        try {
          const resolvers = getAutoImportConfig(state.ctx.configService)?.resolvers as Resolver[] | undefined
          const loaded = loadExternalComponentMetadata(from, cwd, resolvers)
          if (loaded?.types?.size) {
            state.componentMetadataMap.set(name, { types: new Map(loaded.types), docs: new Map() })
            return {
              types: new Map(loaded.types),
              docs: new Map(),
            }
          }
        }
        catch {
          // 忽略
        }
      }
    }

    const existing = state.componentMetadataMap.get(name)
    if (existing) {
      return {
        types: new Map(existing.types),
        docs: new Map(existing.docs),
      }
    }

    const record = state.registry.get(name)
    if (record && record.kind === 'local') {
      let metadata = extractJsonPropMetadata(record.entry.json as Record<string, any>)
      const candidatePaths = new Set<string>()
      if (record.entry.jsonPath) {
        candidatePaths.add(record.entry.jsonPath)
      }
      const configService = state.ctx.configService
      if (configService) {
        const from = record.value.from?.replace(/^\//, '')
        if (from) {
          candidatePaths.add(path.resolve(configService.absoluteSrcRoot, `${from}.json`))
        }
        const manifestFrom = state.manifestCache.get(name)?.replace(/^\//, '')
        if (manifestFrom) {
          candidatePaths.add(path.resolve(configService.absoluteSrcRoot, `${manifestFrom}.json`))
        }
      }

      if (metadata.props.size === 0 && metadata.docs.size === 0 && candidatePaths.size > 0) {
        for (const candidate of candidatePaths) {
          try {
            const raw = fs.readJsonSync(candidate)
            metadata = extractJsonPropMetadata(raw)
            if (metadata.props.size > 0 || metadata.docs.size > 0) {
              logger.debug?.(`[auto-import] loaded metadata for ${name} from ${candidate}`)
              break
            }
          }
          catch {
            // 文件不存在时忽略
          }
        }
      }
      logger.debug?.(`[auto-import] metadata for ${name}: props=${metadata.props.size} docs=${metadata.docs.size}`)
      return {
        types: new Map(metadata.props),
        docs: new Map(metadata.docs),
      }
    }
    return { types: new Map<string, string>(), docs: new Map<string, string>() }
  }

  function preloadResolverComponentMetadata() {
    const cwd = state.ctx.configService?.cwd
    if (!cwd) {
      return
    }

    const resolvers = getAutoImportConfig(state.ctx.configService)?.resolvers as Resolver[] | undefined
    const resolverEntries = state.collectResolverComponents()
    if (!resolverEntries || Object.keys(resolverEntries).length === 0) {
      return
    }

    for (const [name, from] of Object.entries(resolverEntries)) {
      if (!from) {
        continue
      }
      const existing = state.componentMetadataMap.get(name)
      if (existing && existing.types.size > 0) {
        continue
      }
      try {
        const loaded = loadExternalComponentMetadata(from, cwd, resolvers)
        if (loaded?.types?.size) {
          state.componentMetadataMap.set(name, { types: new Map(loaded.types), docs: new Map() })
        }
      }
      catch {
        // 忽略
      }
    }
  }

  return {
    getComponentMetadata,
    preloadResolverComponentMetadata,
  }
}

import type { ResolvedValue } from '../../../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../../../context'
import type { SubPackageMetaValue } from '../../../types'
import type { ComponentMetadata } from '../metadata'
import type { LocalAutoImportMatch } from '../types'
import type { OutputsState } from './outputs'
import { removeExtensionDeep } from '@weapp-core/shared'
import { LRUCache } from 'lru-cache'
import { logger } from '../../../context/shared'
import {
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  getVueComponentsSettings,
} from '../config'
import { createMetadataHelpers } from './metadata'
import { createOutputsHelpers } from './outputs'
import { createRegistryHelpers } from './registry'
import { createResolverHelpers } from './resolver'

export type { LocalAutoImportMatch } from '../types'

const logWarnCache = new LRUCache<string, boolean>({
  max: 512,
  ttl: 1000 * 60 * 60,
})

function logWarnOnce(message: string) {
  if (logWarnCache.get(message)) {
    return
  }
  logger.warn(message)
  logWarnCache.set(message, true)
}

export interface ResolverAutoImportMatch {
  kind: 'resolver'
  value: ResolvedValue
}

export type AutoImportMatch = LocalAutoImportMatch | ResolverAutoImportMatch

export interface AutoImportService {
  reset: () => void
  registerPotentialComponent: (filePath: string) => Promise<void>
  removePotentialComponent: (filePath: string) => void
  resolve: (componentName: string, importerBaseName?: string) => AutoImportMatch | undefined
  filter: (id: string, meta?: SubPackageMetaValue) => boolean
  getRegisteredLocalComponents: () => LocalAutoImportMatch[]
  awaitManifestWrites: () => Promise<void>
}

export function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const autoImportState = ctx.runtimeState.autoImport
  const registry = autoImportState.registry
  const manifestFileName = DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME
  const manifestCache = new Map<string, string>()
  const componentMetadataMap = new Map<string, ComponentMetadata>()
  const resolverComponentNames = new Set<string>()
  const resolverComponentsMapRef = { value: {} as Record<string, string> }
  const outputsState: OutputsState = {
    pendingWrite: undefined,
    writeRequested: false,
    pendingTypedWrite: undefined,
    typedWriteRequested: false,
    lastWrittenTypedDefinition: undefined,
    lastTypedDefinitionOutputPath: undefined,
    pendingHtmlCustomDataWrite: undefined,
    htmlCustomDataWriteRequested: false,
    lastWrittenHtmlCustomData: undefined,
    lastHtmlCustomDataOutputPath: undefined,
    pendingVueComponentsWrite: undefined,
    vueComponentsWriteRequested: false,
    lastWrittenVueComponentsDefinition: undefined,
    lastVueComponentsOutputPath: undefined,
    lastHtmlCustomDataEnabled: false,
    lastHtmlCustomDataOutput: undefined,
    lastTypedComponentsEnabled: false,
    lastTypedComponentsOutput: undefined,
    lastVueComponentsEnabled: false,
    lastVueComponentsOutput: undefined,
  }

  const resolverHelpers = createResolverHelpers({
    ctx,
    registry,
    componentMetadataMap,
    resolverComponentNames,
    resolverComponentsMapRef,
  })

  const metadataHelpers = createMetadataHelpers({
    ctx,
    registry,
    componentMetadataMap,
    resolverComponentNames,
    resolverComponentsMapRef,
    manifestCache,
    collectResolverComponents: resolverHelpers.collectResolverComponents,
  })

  const outputsHelpers = createOutputsHelpers({
    ctx,
    registry,
    manifestFileName,
    manifestCache,
    componentMetadataMap,
    outputsState,
    resolverComponentsMapRef,
    collectResolverComponents: resolverHelpers.collectResolverComponents,
    syncResolverComponentProps: resolverHelpers.syncResolverComponentProps,
    preloadResolverComponentMetadata: metadataHelpers.preloadResolverComponentMetadata,
    getComponentMetadata: metadataHelpers.getComponentMetadata,
    resolveNavigationImport: resolverHelpers.resolveNavigationImport,
  })

  const registryHelpers = createRegistryHelpers({
    ctx,
    registry,
    autoImportState,
    resolverComponentNames,
    componentMetadataMap,
    logWarnOnce,
    scheduleManifestWrite: outputsHelpers.scheduleManifestWrite,
    scheduleTypedComponentsWrite: outputsHelpers.scheduleTypedComponentsWrite,
    scheduleHtmlCustomDataWrite: outputsHelpers.scheduleHtmlCustomDataWrite,
    scheduleVueComponentsWrite: outputsHelpers.scheduleVueComponentsWrite,
  })

  return {
    reset() {
      registry.clear()
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
      outputsHelpers.scheduleManifestWrite(true)
      componentMetadataMap.clear()
      resolverComponentNames.clear()
      const typedSettings = getTypedComponentsSettings(ctx)
      const htmlSettings = getHtmlCustomDataSettings(ctx)
      const vueSettings = getVueComponentsSettings(ctx)
      if (typedSettings.enabled || htmlSettings.enabled) {
        resolverHelpers.syncResolverComponentProps()
      }
      outputsHelpers.scheduleTypedComponentsWrite(true)
      outputsHelpers.scheduleHtmlCustomDataWrite(true)
      if (vueSettings.enabled) {
        resolverHelpers.syncResolverComponentProps()
      }
      outputsHelpers.scheduleVueComponentsWrite(true)
    },

    async registerPotentialComponent(filePath: string) {
      await registryHelpers.registerLocalComponent(filePath)
    },

    removePotentialComponent(filePath: string) {
      const { removed, removedNames } = registryHelpers.removeRegisteredComponent({
        baseName: removeExtensionDeep(filePath),
        templatePath: filePath,
      })
      outputsHelpers.scheduleManifestWrite(removed)
      for (const name of removedNames) {
        if (resolverComponentNames.has(name)) {
          componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
        }
        else {
          componentMetadataMap.delete(name)
        }
      }
      outputsHelpers.scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      outputsHelpers.scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      outputsHelpers.scheduleVueComponentsWrite(removed || removedNames.length > 0)
    },

    resolve(componentName: string, importerBaseName?: string) {
      const local = registry.get(componentName)
      if (local) {
        return local
      }

      const resolvedValue = resolverHelpers.resolveWithResolvers(componentName, importerBaseName)
      if (resolvedValue) {
        const resolved: ResolverAutoImportMatch = {
          kind: 'resolver',
          value: resolvedValue,
        }
        const typedSettings = getTypedComponentsSettings(ctx)
        const htmlSettings = getHtmlCustomDataSettings(ctx)
        const vueSettings = getVueComponentsSettings(ctx)
        if (typedSettings.enabled || htmlSettings.enabled) {
          if (!componentMetadataMap.has(resolved.value.name)) {
            componentMetadataMap.set(resolved.value.name, { types: new Map(), docs: new Map() })
          }
          if (typedSettings.enabled) {
            outputsHelpers.scheduleTypedComponentsWrite(true)
          }
          if (htmlSettings.enabled) {
            outputsHelpers.scheduleHtmlCustomDataWrite(true)
          }
        }
        else {
          componentMetadataMap.delete(resolved.value.name)
        }
        if (vueSettings.enabled) {
          outputsHelpers.scheduleVueComponentsWrite(true)
        }
        return resolved
      }
      return undefined
    },

    filter(id: string, _meta?: SubPackageMetaValue) {
      const globMatcher = registryHelpers.ensureMatcher()
      if (!globMatcher) {
        return false
      }
      return globMatcher(id)
    },

    getRegisteredLocalComponents() {
      return Array.from(registry.values())
    },

    awaitManifestWrites() {
      return Promise.all([
        outputsState.pendingWrite ?? Promise.resolve(),
        outputsState.pendingTypedWrite ?? Promise.resolve(),
        outputsState.pendingHtmlCustomDataWrite ?? Promise.resolve(),
        outputsState.pendingVueComponentsWrite ?? Promise.resolve(),
      ]).then(() => {})
    },
  }
}

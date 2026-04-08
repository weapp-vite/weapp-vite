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
  getVersion: () => number
  runInBatch: <T>(task: () => T | Promise<T>) => Promise<T>
  registerPotentialComponent: (filePath: string) => Promise<void>
  removePotentialComponent: (filePath: string) => void
  resolve: (componentName: string, importerBaseName?: string) => AutoImportMatch | undefined
  setSupportFileResolverComponents: (components: Record<string, string>) => void
  clearSupportFileResolverComponents: () => void
  collectStaticResolverComponentsForSupportFiles: () => Record<string, string>
  filter: (id: string, meta?: SubPackageMetaValue) => boolean
  getRegisteredLocalComponents: () => LocalAutoImportMatch[]
  awaitPendingRegistrations?: () => Promise<void>
  awaitManifestWrites: () => Promise<void>
}

interface AutoImportOutputSettingsSnapshot {
  typed: ReturnType<typeof getTypedComponentsSettings>
  html: ReturnType<typeof getHtmlCustomDataSettings>
  vue: ReturnType<typeof getVueComponentsSettings>
}

export function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const autoImportState = ctx.runtimeState.autoImport
  const registry = autoImportState.registry
  const resolvedResolverComponents = autoImportState.resolvedResolverComponents
  const manifestFileName = DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME
  const manifestCache = new Map<string, string>()
  const componentMetadataMap = new Map<string, ComponentMetadata>()
  const resolverComponentNames = new Set<string>()
  const resolverComponentsMapRef = { value: {} as Record<string, string> }
  const pendingRegistrations = new Set<Promise<void>>()
  const batchedWrites: {
    depth: number
    manifest?: boolean
    typed?: boolean
    html?: boolean
    vue?: boolean
  } = {
    depth: 0,
    manifest: undefined,
    typed: undefined,
    html: undefined,
    vue: undefined,
  }
  let outputSettingsSnapshot: AutoImportOutputSettingsSnapshot | undefined
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
    preparedSyncStateVersion: undefined,
    preparedSyncStatePromise: undefined,
  }

  const resolverHelpers = createResolverHelpers({
    ctx,
    registry,
    resolvedResolverComponents,
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
    getPreparedStateVersion: () => autoImportState.version,
    resolverComponentsMapRef,
    collectResolverComponents: resolverHelpers.collectResolverComponents,
    collectManifestResolverComponents: resolverHelpers.collectManifestResolverComponents,
    syncResolverComponentProps: resolverHelpers.syncResolverComponentProps,
    preloadResolverComponentMetadata: metadataHelpers.preloadResolverComponentMetadata,
    getComponentMetadata: metadataHelpers.getComponentMetadata,
    resolveNavigationImport: resolverHelpers.resolveNavigationImport,
  })

  function bumpVersion() {
    autoImportState.version += 1
  }

  function getOutputSettingsSnapshot(): AutoImportOutputSettingsSnapshot {
    if (!outputSettingsSnapshot) {
      outputSettingsSnapshot = {
        typed: getTypedComponentsSettings(ctx),
        html: getHtmlCustomDataSettings(ctx),
        vue: getVueComponentsSettings(ctx),
      }
    }
    return outputSettingsSnapshot
  }

  function deferOrSchedule(kind: 'manifest' | 'typed' | 'html' | 'vue', shouldWrite: boolean) {
    if (batchedWrites.depth > 0) {
      const previous = batchedWrites[kind]
      batchedWrites[kind] = previous === undefined ? shouldWrite : previous || shouldWrite
      return
    }

    if (kind === 'manifest') {
      outputsHelpers.scheduleManifestWrite(shouldWrite)
      return
    }
    if (kind === 'typed') {
      outputsHelpers.scheduleTypedComponentsWrite(shouldWrite)
      return
    }
    if (kind === 'html') {
      outputsHelpers.scheduleHtmlCustomDataWrite(shouldWrite)
      return
    }
    outputsHelpers.scheduleVueComponentsWrite(shouldWrite)
  }

  function flushBatchedWrites() {
    const manifest = batchedWrites.manifest
    const typed = batchedWrites.typed
    const html = batchedWrites.html
    const vue = batchedWrites.vue
    batchedWrites.manifest = undefined
    batchedWrites.typed = undefined
    batchedWrites.html = undefined
    batchedWrites.vue = undefined

    if (manifest !== undefined) {
      outputsHelpers.scheduleManifestWrite(manifest)
    }
    if (typed !== undefined) {
      outputsHelpers.scheduleTypedComponentsWrite(typed)
    }
    if (html !== undefined) {
      outputsHelpers.scheduleHtmlCustomDataWrite(html)
    }
    if (vue !== undefined) {
      outputsHelpers.scheduleVueComponentsWrite(vue)
    }
  }

  const registryHelpers = createRegistryHelpers({
    ctx,
    registry,
    autoImportState,
    resolverComponentNames,
    componentMetadataMap,
    logWarnOnce,
    scheduleManifestWrite: shouldWrite => deferOrSchedule('manifest', shouldWrite),
    scheduleTypedComponentsWrite: shouldWrite => deferOrSchedule('typed', shouldWrite),
    scheduleHtmlCustomDataWrite: shouldWrite => deferOrSchedule('html', shouldWrite),
    scheduleVueComponentsWrite: shouldWrite => deferOrSchedule('vue', shouldWrite),
  })

  return {
    reset() {
      bumpVersion()
      registry.clear()
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
      resolvedResolverComponents.clear()
      resolverHelpers.clearResolveCache()
      deferOrSchedule('manifest', true)
      componentMetadataMap.clear()
      resolverComponentNames.clear()
      const { typed: typedSettings, html: htmlSettings, vue: vueSettings } = getOutputSettingsSnapshot()
      if (typedSettings.enabled || htmlSettings.enabled) {
        resolverHelpers.syncResolverComponentProps()
      }
      deferOrSchedule('typed', true)
      deferOrSchedule('html', true)
      if (vueSettings.enabled) {
        resolverHelpers.syncResolverComponentProps()
      }
      deferOrSchedule('vue', true)
    },

    getVersion() {
      return autoImportState.version
    },

    async runInBatch<T>(task: () => T | Promise<T>) {
      batchedWrites.depth += 1
      try {
        return await task()
      }
      finally {
        batchedWrites.depth -= 1
        if (batchedWrites.depth === 0) {
          flushBatchedWrites()
        }
      }
    },

    async registerPotentialComponent(filePath: string) {
      const task = Promise.resolve()
        .then(async () => {
          await registryHelpers.registerLocalComponent(filePath)
          bumpVersion()
        })
        .finally(() => {
          pendingRegistrations.delete(task)
        })
      pendingRegistrations.add(task)
      await task
    },

    removePotentialComponent(filePath: string) {
      bumpVersion()
      const { removed, removedNames } = registryHelpers.removeRegisteredComponent({
        baseName: removeExtensionDeep(filePath),
        templatePath: filePath,
      })
      deferOrSchedule('manifest', removed)
      for (const name of removedNames) {
        if (resolverComponentNames.has(name)) {
          componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
        }
        else {
          componentMetadataMap.delete(name)
        }
      }
      deferOrSchedule('typed', removed || removedNames.length > 0)
      deferOrSchedule('html', removed || removedNames.length > 0)
      deferOrSchedule('vue', removed || removedNames.length > 0)
    },

    setSupportFileResolverComponents(components: Record<string, string>) {
      const changed = resolverHelpers.setSupportFileResolverComponents(components)
      if (!changed) {
        return
      }
      bumpVersion()
      deferOrSchedule('manifest', true)
      const { typed: typedSettings, html: htmlSettings, vue: vueSettings } = getOutputSettingsSnapshot()
      if (typedSettings.enabled || htmlSettings.enabled) {
        resolverHelpers.syncResolverComponentProps()
      }
      if (typedSettings.enabled) {
        deferOrSchedule('typed', true)
      }
      if (htmlSettings.enabled) {
        deferOrSchedule('html', true)
      }
      if (vueSettings.enabled) {
        resolverHelpers.syncResolverComponentProps()
        deferOrSchedule('vue', true)
      }
    },

    clearSupportFileResolverComponents() {
      const changed = resolverHelpers.clearSupportFileResolverComponents()
      if (!changed) {
        return
      }
      bumpVersion()
      resolverHelpers.syncResolverComponentProps()
    },

    collectStaticResolverComponentsForSupportFiles() {
      return resolverHelpers.collectStaticResolverComponentsForSupportFiles()
    },

    resolve(componentName: string, importerBaseName?: string) {
      const local = registry.get(componentName)
      if (local) {
        return local
      }

      const resolvedValue = resolverHelpers.resolveWithResolvers(componentName, importerBaseName)
      if (resolvedValue) {
        const previousFrom = resolvedResolverComponents.get(resolvedValue.name)
        const resolverChanged = previousFrom !== resolvedValue.from
        resolvedResolverComponents.set(resolvedValue.name, resolvedValue.from)
        if (resolverChanged) {
          bumpVersion()
        }
        const resolved: ResolverAutoImportMatch = {
          kind: 'resolver',
          value: resolvedValue,
        }
        const { typed: typedSettings, html: htmlSettings, vue: vueSettings } = getOutputSettingsSnapshot()
        if (typedSettings.enabled || htmlSettings.enabled) {
          const metadataMissing = !componentMetadataMap.has(resolved.value.name)
          if (metadataMissing) {
            componentMetadataMap.set(resolved.value.name, { types: new Map(), docs: new Map() })
          }
          if (typedSettings.enabled && (resolverChanged || metadataMissing)) {
            deferOrSchedule('typed', true)
          }
          if (htmlSettings.enabled && (resolverChanged || metadataMissing)) {
            deferOrSchedule('html', true)
          }
        }
        else {
          componentMetadataMap.delete(resolved.value.name)
        }
        if (vueSettings.enabled && resolverChanged) {
          deferOrSchedule('vue', true)
        }
        if (resolverChanged) {
          deferOrSchedule('manifest', true)
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

    awaitPendingRegistrations() {
      return Promise.all([...pendingRegistrations]).then(() => {})
    },

    awaitManifestWrites() {
      return Promise.all([
        Promise.all([...pendingRegistrations]),
        outputsState.pendingWrite ?? Promise.resolve(),
        outputsState.pendingTypedWrite ?? Promise.resolve(),
        outputsState.pendingHtmlCustomDataWrite ?? Promise.resolve(),
        outputsState.pendingVueComponentsWrite ?? Promise.resolve(),
      ]).then(() => {})
    },
  }
}

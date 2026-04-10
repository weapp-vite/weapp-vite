import type { ComponentMetadata } from '../metadata'
import type { LocalAutoImportMatch } from '../types'
import type { RegistryHelpers } from './registry'
import type { ResolverHelpers } from './resolver'
import type { AutoImportService, ResolverAutoImportMatch } from './types'
import { removeExtensionDeep } from '@weapp-core/shared'

interface AutoImportActionsOptions {
  registry: Map<string, LocalAutoImportMatch>
  autoImportState: { version: number, matcher?: (input: string) => boolean, matcherKey: string }
  resolvedResolverComponents: Map<string, string>
  componentMetadataMap: Map<string, ComponentMetadata>
  resolverComponentNames: Set<string>
  resolverHelpers: ResolverHelpers
  registryHelpers: RegistryHelpers
  pendingRegistrations: Set<Promise<void>>
  getOutputSettingsSnapshot: () => {
    typed: { enabled: boolean }
    html: { enabled: boolean }
    vue: { enabled: boolean }
  }
  deferOrSchedule: (kind: 'manifest' | 'typed' | 'html' | 'vue', shouldWrite: boolean) => void
  outputsState: {
    pendingWrite?: Promise<void>
    pendingTypedWrite?: Promise<void>
    pendingHtmlCustomDataWrite?: Promise<void>
    pendingVueComponentsWrite?: Promise<void>
  }
}

export function createAutoImportActions(
  options: AutoImportActionsOptions,
): Omit<AutoImportService, 'getVersion' | 'runInBatch'> {
  function bumpVersion() {
    options.autoImportState.version += 1
  }

  return {
    reset() {
      bumpVersion()
      options.registry.clear()
      options.autoImportState.matcher = undefined
      options.autoImportState.matcherKey = ''
      options.resolvedResolverComponents.clear()
      options.resolverHelpers.clearResolveCache()
      options.deferOrSchedule('manifest', true)
      options.componentMetadataMap.clear()
      options.resolverComponentNames.clear()
      const { typed, html, vue } = options.getOutputSettingsSnapshot()
      if (typed.enabled || html.enabled) {
        options.resolverHelpers.syncResolverComponentProps()
      }
      options.deferOrSchedule('typed', true)
      options.deferOrSchedule('html', true)
      if (vue.enabled) {
        options.resolverHelpers.syncResolverComponentProps()
      }
      options.deferOrSchedule('vue', true)
    },

    async registerPotentialComponent(filePath: string) {
      const task = Promise.resolve()
        .then(async () => {
          await options.registryHelpers.registerLocalComponent(filePath)
        })
        .finally(() => {
          options.pendingRegistrations.delete(task)
        })
      options.pendingRegistrations.add(task)
      await task
    },

    removePotentialComponent(filePath: string) {
      bumpVersion()
      const { removed, removedNames } = options.registryHelpers.removeRegisteredComponent({
        baseName: removeExtensionDeep(filePath),
        templatePath: filePath,
      })
      options.deferOrSchedule('manifest', removed)
      for (const name of removedNames) {
        if (options.resolverComponentNames.has(name)) {
          options.componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
        }
        else {
          options.componentMetadataMap.delete(name)
        }
      }
      const shouldWriteArtifacts = removed || removedNames.length > 0
      options.deferOrSchedule('typed', shouldWriteArtifacts)
      options.deferOrSchedule('html', shouldWriteArtifacts)
      options.deferOrSchedule('vue', shouldWriteArtifacts)
    },

    setSupportFileResolverComponents(components: Record<string, string>) {
      const changed = options.resolverHelpers.setSupportFileResolverComponents(components)
      if (!changed) {
        return
      }
      bumpVersion()
      options.deferOrSchedule('manifest', true)
      const { typed, html, vue } = options.getOutputSettingsSnapshot()
      if (typed.enabled || html.enabled) {
        options.resolverHelpers.syncResolverComponentProps()
      }
      if (typed.enabled) {
        options.deferOrSchedule('typed', true)
      }
      if (html.enabled) {
        options.deferOrSchedule('html', true)
      }
      if (vue.enabled) {
        options.resolverHelpers.syncResolverComponentProps()
        options.deferOrSchedule('vue', true)
      }
    },

    clearSupportFileResolverComponents() {
      const changed = options.resolverHelpers.clearSupportFileResolverComponents()
      if (!changed) {
        return
      }
      bumpVersion()
      options.resolverHelpers.syncResolverComponentProps()
    },

    collectStaticResolverComponentsForSupportFiles() {
      return options.resolverHelpers.collectStaticResolverComponentsForSupportFiles()
    },

    resolve(componentName: string, importerBaseName?: string) {
      const local = options.registry.get(componentName)
      if (local) {
        return local
      }

      const resolvedValue = options.resolverHelpers.resolveWithResolvers(componentName, importerBaseName)
      if (!resolvedValue) {
        return undefined
      }

      const previousFrom = options.resolvedResolverComponents.get(resolvedValue.name)
      const resolverChanged = previousFrom !== resolvedValue.from
      options.resolvedResolverComponents.set(resolvedValue.name, resolvedValue.from)
      if (resolverChanged) {
        bumpVersion()
      }
      const resolved: ResolverAutoImportMatch = {
        kind: 'resolver',
        value: resolvedValue,
      }
      const { typed, html, vue } = options.getOutputSettingsSnapshot()
      if (typed.enabled || html.enabled) {
        const metadataMissing = !options.componentMetadataMap.has(resolved.value.name)
        if (metadataMissing) {
          options.componentMetadataMap.set(resolved.value.name, { types: new Map(), docs: new Map() })
        }
        if (typed.enabled && (resolverChanged || metadataMissing)) {
          options.deferOrSchedule('typed', true)
        }
        if (html.enabled && (resolverChanged || metadataMissing)) {
          options.deferOrSchedule('html', true)
        }
      }
      else {
        options.componentMetadataMap.delete(resolved.value.name)
      }
      if (vue.enabled && resolverChanged) {
        options.deferOrSchedule('vue', true)
      }
      if (resolverChanged) {
        options.deferOrSchedule('manifest', true)
      }
      return resolved
    },

    filter(id: string) {
      const globMatcher = options.registryHelpers.ensureMatcher()
      if (!globMatcher) {
        return false
      }
      return globMatcher(id)
    },

    getRegisteredLocalComponents() {
      return Array.from(options.registry.values())
    },

    awaitPendingRegistrations() {
      return Promise.all([...options.pendingRegistrations]).then(() => {})
    },

    awaitManifestWrites() {
      return Promise.all([
        Promise.all([...options.pendingRegistrations]),
        options.outputsState.pendingWrite ?? Promise.resolve(),
        options.outputsState.pendingTypedWrite ?? Promise.resolve(),
        options.outputsState.pendingHtmlCustomDataWrite ?? Promise.resolve(),
        options.outputsState.pendingVueComponentsWrite ?? Promise.resolve(),
      ]).then(() => {})
    },
  }
}

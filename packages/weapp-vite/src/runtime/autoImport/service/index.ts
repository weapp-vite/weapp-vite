import type { MutableCompilerContext } from '../../../context'
import type { ComponentMetadata } from '../metadata'
import type { OutputsState } from './outputs'
import type { AutoImportService } from './types'
import {
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
} from '../config'
import { createAutoImportActions } from './actions'
import { createMetadataHelpers } from './metadata'
import { createOutputsHelpers } from './outputs'
import { createRegistryHelpers } from './registry'
import { createResolverHelpers } from './resolver'
import { createAutoImportScheduling } from './scheduling'
import { logWarnOnce } from './shared'

export type { LocalAutoImportMatch } from './types'
export type { AutoImportMatch, AutoImportService, ResolverAutoImportMatch } from './types'

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

  const scheduling = createAutoImportScheduling({
    ctx,
    outputsHelpers,
  })

  const registryHelpers = createRegistryHelpers({
    ctx,
    registry,
    autoImportState,
    resolverComponentNames,
    componentMetadataMap,
    logWarnOnce,
    bumpVersion: () => {
      autoImportState.version += 1
    },
    scheduleManifestWrite: shouldWrite => scheduling.deferOrSchedule('manifest', shouldWrite),
    scheduleTypedComponentsWrite: shouldWrite => scheduling.deferOrSchedule('typed', shouldWrite),
    scheduleHtmlCustomDataWrite: shouldWrite => scheduling.deferOrSchedule('html', shouldWrite),
    scheduleVueComponentsWrite: shouldWrite => scheduling.deferOrSchedule('vue', shouldWrite),
  })

  const actions = createAutoImportActions({
    registry,
    autoImportState,
    resolvedResolverComponents,
    componentMetadataMap,
    resolverComponentNames,
    resolverHelpers,
    registryHelpers,
    pendingRegistrations,
    getOutputSettingsSnapshot: scheduling.getOutputSettingsSnapshot,
    deferOrSchedule: scheduling.deferOrSchedule,
    outputsState,
  })

  return {
    ...actions,
    getVersion() {
      return autoImportState.version
    },
    async runInBatch<T>(task: () => T | Promise<T>) {
      return await scheduling.runInBatch(task)
    },
  }
}

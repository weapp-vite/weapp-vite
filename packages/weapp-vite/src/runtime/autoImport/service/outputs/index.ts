import type { MutableCompilerContext } from '../../../context'
import type { ComponentMetadata } from '../metadata'
import type { LocalAutoImportMatch } from '../types'
import type { OutputsHelpers, OutputsState } from './state'
import { writeManifestFile } from './manifest'
import { createScheduleHelpers } from './schedule'
import {
  syncHtmlCustomData,
  syncTypedComponentsDefinition,
  syncVueComponentsDefinition,
} from './sync'

interface OutputsOptions {
  ctx: MutableCompilerContext
  registry: Map<string, LocalAutoImportMatch>
  manifestFileName: string
  manifestCache: Map<string, string>
  componentMetadataMap: Map<string, ComponentMetadata>
  outputsState: OutputsState
  resolverComponentsMapRef: { value: Record<string, string> }
  collectResolverComponents: () => Record<string, string>
  syncResolverComponentProps: () => void
  preloadResolverComponentMetadata: () => void
  getComponentMetadata: (name: string) => ComponentMetadata
  resolveNavigationImport: (from: string) => string | undefined
}

export function createOutputsHelpers(options: OutputsOptions): OutputsHelpers {
  const {
    ctx,
    registry,
    manifestFileName,
    manifestCache,
    componentMetadataMap,
    outputsState,
    resolverComponentsMapRef,
    collectResolverComponents,
    syncResolverComponentProps,
    preloadResolverComponentMetadata,
    getComponentMetadata,
    resolveNavigationImport,
  } = options

  const commonSyncOptions: CommonSyncOptions = {
    ctx,
    outputsState,
    collectResolverComponents,
    registry,
    componentMetadataMap,
    syncResolverComponentProps,
    preloadResolverComponentMetadata,
    getComponentMetadata,
  }

  const scheduleHelpers = createScheduleHelpers({
    ctx,
    outputsState,
    manifestFileName,
    writeManifest: async (outputPath) => {
      await writeManifestFile({
        outputPath,
        collectResolverComponents,
        registry,
        manifestCache,
        scheduleHtmlCustomDataWrite: scheduleHelpers.scheduleHtmlCustomDataWrite,
      })
    },
    syncTyped: async settings => syncTypedComponentsDefinition(settings, commonSyncOptions),
    syncHtmlCustomData: async settings => syncHtmlCustomData(settings, commonSyncOptions),
    syncVueComponents: async settings => syncVueComponentsDefinition(settings, {
      ...commonSyncOptions,
      resolverComponentsMapRef,
      resolveNavigationImport,
    }),
  })

  return {
    scheduleManifestWrite: scheduleHelpers.scheduleManifestWrite,
    scheduleTypedComponentsWrite: scheduleHelpers.scheduleTypedComponentsWrite,
    scheduleHtmlCustomDataWrite: scheduleHelpers.scheduleHtmlCustomDataWrite,
    scheduleVueComponentsWrite: scheduleHelpers.scheduleVueComponentsWrite,
  }
}

import type { ComponentMetadata } from '../../metadata'

export interface OutputsState {
  pendingWrite?: Promise<void>
  writeRequested: boolean
  pendingTypedWrite?: Promise<void>
  typedWriteRequested: boolean
  lastWrittenTypedDefinition?: string
  lastTypedDefinitionOutputPath?: string
  pendingHtmlCustomDataWrite?: Promise<void>
  htmlCustomDataWriteRequested: boolean
  lastWrittenHtmlCustomData?: string
  lastHtmlCustomDataOutputPath?: string
  pendingVueComponentsWrite?: Promise<void>
  vueComponentsWriteRequested: boolean
  lastWrittenVueComponentsDefinition?: string
  lastVueComponentsOutputPath?: string
  lastWrittenLayoutTypesDefinition?: string
  lastLayoutTypesOutputPath?: string
  lastHtmlCustomDataEnabled: boolean
  lastHtmlCustomDataOutput?: string
  lastTypedComponentsEnabled: boolean
  lastTypedComponentsOutput?: string
  lastVueComponentsEnabled: boolean
  lastVueComponentsOutput?: string
  preparedSyncStateVersion?: number
  preparedSyncStatePromise?: Promise<PreparedSyncState>
}

export interface OutputsHelpers {
  scheduleManifestWrite: (shouldWrite: boolean) => void
  scheduleTypedComponentsWrite: (shouldWrite: boolean) => void
  scheduleHtmlCustomDataWrite: (shouldWrite: boolean) => void
  scheduleVueComponentsWrite: (shouldWrite: boolean) => void
}

export interface PreparedSyncState {
  componentNames: string[]
  componentMetadataMap: Map<string, ComponentMetadata>
}

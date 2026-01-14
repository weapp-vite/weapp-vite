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
  lastHtmlCustomDataEnabled: boolean
  lastHtmlCustomDataOutput?: string
  lastTypedComponentsEnabled: boolean
  lastTypedComponentsOutput?: string
  lastVueComponentsEnabled: boolean
  lastVueComponentsOutput?: string
}

export interface OutputsHelpers {
  scheduleManifestWrite: (shouldWrite: boolean) => void
  scheduleTypedComponentsWrite: (shouldWrite: boolean) => void
  scheduleHtmlCustomDataWrite: (shouldWrite: boolean) => void
  scheduleVueComponentsWrite: (shouldWrite: boolean) => void
}

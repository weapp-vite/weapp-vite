import type {
  RuntimeProviderBackend,
  RuntimeProviderCompilation,
  RuntimeProviderDescriptorContract,
  RuntimeProviderModuleKind,
  RuntimeProviderVariant,
} from '@weapp-core/shared'

export interface RuntimeProvider {
  descriptor: RuntimeProviderDescriptorContract
  resolveModuleId?: (entry: ResolvedRuntimeProviderEntry) => Promise<string> | string
}

export interface RuntimeProviderSelection {
  backend: RuntimeProviderBackend
  compilation: RuntimeProviderCompilation
}

export interface ResolvedRuntimeProviderEntry {
  kind: RuntimeProviderModuleKind
  moduleId: string
  provider: RuntimeProvider
  variant: RuntimeProviderVariant
}

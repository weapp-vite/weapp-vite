export type RuntimeProviderBackend = 'miniprogram' | 'web'

export type RuntimeProviderCompilation = 'native' | 'vue' | 'web'

export type RuntimeProviderModuleKind = 'runtime' | 'reactivity' | 'template'

export type RuntimeProviderVariant = 'development' | 'production'

export type RuntimeProviderInjectionMode = 'none' | 'virtual-module'

export type RuntimeProviderHmrMode = 'none' | 'host-reload' | 'module-accept'

/**
 * 运行时 provider 的开发与生产入口。
 */
export interface RuntimeProviderEntry {
  development: string
  production: string
}

/**
 * 运行时 provider 的声明式能力。
 */
export interface RuntimeProviderCapabilities {
  framework: boolean
  hmr: boolean
  nativeHost: boolean
  webHost: boolean
}

/**
 * 运行时 provider 的 HMR 契约。
 */
export interface RuntimeProviderHmrDescriptor {
  mode: RuntimeProviderHmrMode
  acceptCode?: string
}

/**
 * 跨包共享的运行时 provider 描述契约。
 */
export interface RuntimeProviderDescriptorContract {
  id: string
  backend: RuntimeProviderBackend
  compilation: RuntimeProviderCompilation
  injection: RuntimeProviderInjectionMode
  entries: Readonly<Partial<Record<RuntimeProviderModuleKind, RuntimeProviderEntry>>>
  capabilities: Readonly<RuntimeProviderCapabilities>
  hmr: Readonly<RuntimeProviderHmrDescriptor>
  contractVersion: number
}

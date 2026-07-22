import type { RuntimeProviderCompilation, RuntimeProviderVariant } from '@weapp-core/shared'
import type { RuntimeProvider } from './types'
import { nativeMiniprogramRuntimeProvider, webRuntimeProvider, wevuMiniprogramRuntimeProvider } from './builtins'
import { createRuntimeProviderPlugin, resolveRuntimeProviderEntry, resolveRuntimeProviderHmrFooter } from './plugin'
import { RuntimeProviderRegistry } from './registry'

export const runtimeProviderRegistry = new RuntimeProviderRegistry()
runtimeProviderRegistry.register(nativeMiniprogramRuntimeProvider)
runtimeProviderRegistry.register(wevuMiniprogramRuntimeProvider)
runtimeProviderRegistry.register(webRuntimeProvider)

export function resolveRuntimeProvider(
  backend: 'miniprogram' | 'web',
  compilation: RuntimeProviderCompilation,
) {
  return runtimeProviderRegistry.resolve({ backend, compilation })
}

export function createSelectedRuntimeProviderPlugin(
  provider: RuntimeProvider,
  isDev: boolean,
) {
  const variant: RuntimeProviderVariant = isDev ? 'development' : 'production'
  return createRuntimeProviderPlugin(provider, variant)
}

export {
  createRuntimeProviderPlugin,
  nativeMiniprogramRuntimeProvider,
  resolveRuntimeProviderEntry,
  resolveRuntimeProviderHmrFooter,
  RuntimeProviderRegistry,
  webRuntimeProvider,
  wevuMiniprogramRuntimeProvider,
}
export type { ResolvedRuntimeProviderEntry, RuntimeProvider, RuntimeProviderSelection } from './types'

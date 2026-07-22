import type { RuntimeProviderModuleKind, RuntimeProviderVariant } from '@weapp-core/shared'
import type { Plugin } from 'vite'
import type { ResolvedRuntimeProviderEntry, RuntimeProvider } from './types'
import {
  WEAPP_VITE_RUNTIME_CONTRACT_VERSION,
  WEAPP_VITE_RUNTIME_VIRTUAL_IDS,
} from '@weapp-core/constants'

const runtimeKindByVirtualId = new Map<string, RuntimeProviderModuleKind>(
  Object.entries(WEAPP_VITE_RUNTIME_VIRTUAL_IDS)
    .map(([kind, id]) => [id, kind as RuntimeProviderModuleKind]),
)

export function resolveRuntimeProviderEntry(
  provider: RuntimeProvider,
  kind: RuntimeProviderModuleKind,
  variant: RuntimeProviderVariant,
): ResolvedRuntimeProviderEntry {
  const { descriptor } = provider
  if (descriptor.contractVersion !== WEAPP_VITE_RUNTIME_CONTRACT_VERSION) {
    throw new Error(
      `运行时 provider "${descriptor.id}" 的 contract version 为 ${descriptor.contractVersion}，`
      + `当前编译器要求 ${WEAPP_VITE_RUNTIME_CONTRACT_VERSION}。`,
    )
  }
  if (descriptor.injection === 'none') {
    throw new Error(`运行时 provider "${descriptor.id}" 不允许注入框架运行时。`)
  }
  const entry = descriptor.entries[kind]
  if (!entry) {
    throw new Error(`运行时 provider "${descriptor.id}" 未声明 ${kind} 入口。`)
  }
  return {
    kind,
    moduleId: entry[variant],
    provider,
    variant,
  }
}

export function resolveRuntimeProviderHmrFooter(provider: RuntimeProvider) {
  const { hmr } = provider.descriptor
  return hmr.mode === 'module-accept' ? hmr.acceptCode : undefined
}

export function createRuntimeProviderPlugin(
  provider: RuntimeProvider,
  variant: RuntimeProviderVariant,
): Plugin {
  return {
    name: `weapp-vite:runtime-provider:${provider.descriptor.id}`,
    enforce: 'pre',
    async resolveId(id, importer) {
      const kind = runtimeKindByVirtualId.get(id)
      if (!kind) {
        return null
      }
      const entry = resolveRuntimeProviderEntry(provider, kind, variant)
      let moduleId = entry.moduleId
      try {
        moduleId = await provider.resolveModuleId?.(entry) ?? moduleId
      }
      catch (cause) {
        throw new Error(
          `运行时 provider "${provider.descriptor.id}" 无法定位 ${variant} ${kind} 入口 "${entry.moduleId}"。`,
          { cause },
        )
      }
      const resolved = await this.resolve(moduleId, importer, { skipSelf: true })
      if (!resolved) {
        throw new Error(
          `运行时 provider "${provider.descriptor.id}" 无法解析 ${variant} ${kind} 入口 "${entry.moduleId}"。`,
        )
      }
      return resolved
    },
  }
}

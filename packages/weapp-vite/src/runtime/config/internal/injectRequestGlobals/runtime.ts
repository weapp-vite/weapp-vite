import type { MiniProgramNetworkDefaults } from '@wevu/web-apis'
import type { WeappInjectRequestGlobalsTarget, WeappInjectWebRuntimeDerivedGlobalTarget } from '../../../../types'
import { WEB_RUNTIME_DERIVED_GLOBAL_TARGETS } from '@weapp-core/constants'
import { FULL_REQUEST_GLOBAL_TARGETS, resolveRequestGlobalsTargetDependencies } from './targets'

/** 原生注入可精确改写的全局对象点号访问前缀；计算属性与别名仍按全局语义处理。 */
export const WEB_RUNTIME_GLOBAL_OBJECT_NAMES = ['globalThis', 'global', 'self', 'window'] as const

export type RequestGlobalFreeBindingTarget = WeappInjectRequestGlobalsTarget | WeappInjectWebRuntimeDerivedGlobalTarget

/** 派生目标集合的唯一来源在 @weapp-core/constants，公开类型与运行时共用同一份。 */
export const WEB_RUNTIME_DERIVED_BINDING_TARGETS = WEB_RUNTIME_DERIVED_GLOBAL_TARGETS

const REQUEST_GLOBAL_FREE_BINDING_TARGETS = new Set<RequestGlobalFreeBindingTarget>([
  ...FULL_REQUEST_GLOBAL_TARGETS,
  ...WEB_RUNTIME_DERIVED_BINDING_TARGETS,
])

export function resolveRequestGlobalsRuntimeModuleId() {
  return 'weapp-vite/web-apis'
}

export function resolveNativeRequestGlobalsRuntimeModuleId() {
  return 'weapp-vite/web-apis/runtime'
}

export function resolveRequestGlobalsBindingTargets(targets: WeappInjectRequestGlobalsTarget[]) {
  const expandedTargets = resolveRequestGlobalsTargetDependencies(targets)
  const bindingTargets: RequestGlobalFreeBindingTarget[] = [...expandedTargets]
  const needsRequestRuntimeBinarySupport = expandedTargets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
    || target === 'WebSocket'
  ))

  if (needsRequestRuntimeBinarySupport) {
    bindingTargets.push('TextEncoder', 'TextDecoder')
    bindingTargets.push('URL', 'URLSearchParams', 'Blob', 'File', 'FormData')
  }

  if (targets.includes('CustomEvent')) {
    bindingTargets.push('Event')
  }

  return [...new Set(bindingTargets)].filter(target => REQUEST_GLOBAL_FREE_BINDING_TARGETS.has(target))
}

export function createRequestGlobalsInstallerOptionsCode(
  targets: WeappInjectRequestGlobalsTarget[],
  networkDefaults?: MiniProgramNetworkDefaults,
) {
  const options = [`targets: ${JSON.stringify(targets)}`]
  if (networkDefaults !== undefined) {
    options.push(`networkDefaults: ${JSON.stringify(networkDefaults)}`)
  }
  return `{ ${options.join(', ')} }`
}

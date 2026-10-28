import type { WeappInjectWebRuntimeGlobalsTarget } from '../../../../types'
import { WEB_RUNTIME_GLOBAL_TARGETS, WEB_RUNTIME_STREAM_TARGETS } from '@weapp-core/constants'

export { resolveWebRuntimeGlobalTargetDependencies as resolveRequestGlobalsTargetDependencies } from '@weapp-core/constants'

export const STREAM_REQUEST_GLOBAL_TARGETS: WeappInjectWebRuntimeGlobalsTarget[] = [...WEB_RUNTIME_STREAM_TARGETS]
export const FULL_REQUEST_GLOBAL_TARGETS: WeappInjectWebRuntimeGlobalsTarget[] = [...WEB_RUNTIME_GLOBAL_TARGETS]

export const ABORT_REQUEST_GLOBAL_TARGETS: WeappInjectWebRuntimeGlobalsTarget[] = [
  'AbortController',
  'AbortSignal',
]

export const REQUEST_RUNTIME_REQUEST_TARGETS: WeappInjectWebRuntimeGlobalsTarget[] = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  ...STREAM_REQUEST_GLOBAL_TARGETS,
]

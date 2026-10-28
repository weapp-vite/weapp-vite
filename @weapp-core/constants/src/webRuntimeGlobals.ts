export const WEB_RUNTIME_STREAM_TARGETS = [
  'ReadableStream',
  'WritableStream',
  'TransformStream',
] as const

export const WEB_RUNTIME_GLOBAL_TARGETS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  'WebSocket',
  'atob',
  'btoa',
  'queueMicrotask',
  'performance',
  'crypto',
  'Event',
  'CustomEvent',
  ...WEB_RUNTIME_STREAM_TARGETS,
  'TextDecoderStream',
  'EventSource',
] as const

export type WebRuntimeGlobalTarget = typeof WEB_RUNTIME_GLOBAL_TARGETS[number]

/** 将全局构造器的依赖展开为同一套流实现，供 prelude 和 chunk 绑定共同使用。 */
export function resolveWebRuntimeGlobalTargetDependencies(targets: readonly WebRuntimeGlobalTarget[]) {
  const resolved = new Set(targets)
  if (resolved.has('EventSource')) {
    for (const target of [
      'fetch',
      'Headers',
      'Request',
      'Response',
      'AbortController',
      'AbortSignal',
      'TextDecoder',
      'Event',
    ] as const) {
      resolved.add(target)
    }
  }
  if (resolved.has('TextDecoderStream')) {
    resolved.add('TextDecoder')
  }
  if (
    WEB_RUNTIME_STREAM_TARGETS.some(target => resolved.has(target))
    || resolved.has('TextDecoderStream')
    || resolved.has('fetch')
    || resolved.has('Request')
    || resolved.has('Response')
  ) {
    for (const target of WEB_RUNTIME_STREAM_TARGETS) {
      resolved.add(target)
    }
  }
  if ((['fetch', 'Request', 'Response', 'XMLHttpRequest', 'WebSocket'] as const).some(target => resolved.has(target))) {
    resolved.add('TextEncoder')
    resolved.add('TextDecoder')
  }
  if (resolved.has('CustomEvent')) {
    resolved.add('Event')
  }
  return [...resolved]
}

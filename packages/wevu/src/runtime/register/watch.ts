import type { WatchStopHandle } from '../../reactivity'
import type {
  ComponentPublicInstance,
  InternalRuntimeState,
  RuntimeInstance,
} from '../types'

type WatchHandler = (this: any, value: any, oldValue: any) => void
export type WatchDescriptor = WatchHandler | string | {
  handler: WatchHandler | string
  immediate?: boolean
  deep?: boolean
}
export type WatchMap = Record<string, WatchDescriptor>

export function normalizeWatchDescriptor(
  descriptor: WatchDescriptor,
  runtime: RuntimeInstance<any, any, any>,
  instance: InternalRuntimeState,
): { handler: WatchHandler, options: any } | undefined {
  if (typeof descriptor === 'function') {
    return {
      handler: descriptor.bind(runtime.proxy),
      options: {},
    }
  }

  if (typeof descriptor === 'string') {
    const method = (runtime.methods as any)?.[descriptor] ?? (instance as any)[descriptor]
    if (typeof method === 'function') {
      return {
        handler: method.bind(runtime.proxy),
        options: {},
      }
    }
    return undefined
  }

  if (!descriptor || typeof descriptor !== 'object') {
    return undefined
  }

  const base = normalizeWatchDescriptor((descriptor as any).handler, runtime, instance)
  if (!base) {
    return undefined
  }

  const options: any = {
    ...base.options,
  }

  if ((descriptor as any).immediate !== undefined) {
    options.immediate = (descriptor as any).immediate
  }
  if ((descriptor as any).deep !== undefined) {
    options.deep = (descriptor as any).deep
  }

  return {
    handler: base.handler,
    options,
  }
}

export function createPathGetter(target: ComponentPublicInstance<any, any, any>, path: string) {
  const segments = path.split('.').map(segment => segment.trim()).filter(Boolean)
  if (!segments.length) {
    return () => target
  }

  return () => {
    let current: any = target
    for (const segment of segments) {
      if (current == null) {
        return current
      }
      current = current[segment]
    }
    return current
  }
}

export function registerWatches(
  runtime: RuntimeInstance<any, any, any>,
  watchMap: WatchMap,
  instance: InternalRuntimeState,
) {
  const stops: WatchStopHandle[] = []
  const proxy = runtime.proxy

  for (const [expression, descriptor] of Object.entries(watchMap)) {
    const normalized = normalizeWatchDescriptor(descriptor as any, runtime, instance)
    if (!normalized) {
      continue
    }
    const getter = createPathGetter(proxy, expression)
    const stopHandle = runtime.watch(getter, normalized.handler, normalized.options)
    stops.push(stopHandle)
  }

  return stops
}

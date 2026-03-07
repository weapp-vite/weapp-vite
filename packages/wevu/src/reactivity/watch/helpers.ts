import type { Ref } from '../ref'
import type { WatchScheduler, WatchSource, WatchSources } from './types'
import { nextTick } from '../../scheduler'
import { queueJob } from '../core'
import { isReactive, touchReactive } from '../reactive'
import { isRef } from '../ref'
import { traverse } from '../traverse'
import { getDeepWatchStrategy } from './types'

interface WatchGetterContext {
  getter: () => any
  isMultiSource: boolean
  isReactiveSource: boolean
}

function resolveWatchSource(item: WatchSource<any> | object) {
  if (typeof item === 'function') {
    return (item as () => any)()
  }
  if (isRef(item)) {
    return (item as Ref<any>).value
  }
  if (isReactive(item)) {
    return item
  }
  throw new Error('无效的 watch 源')
}

export function createWatchGetter(source: WatchSources<any>): WatchGetterContext {
  const isReactiveSource = isReactive(source)
  const isMultiSource = Array.isArray(source) && !isReactiveSource
  let getter: () => any

  if (isMultiSource) {
    const sources = source as ReadonlyArray<WatchSource<any> | object>
    getter = () => sources.map(item => resolveWatchSource(item))
  }
  else if (typeof source === 'function') {
    getter = source as () => any
  }
  else if (isRef(source)) {
    getter = () => (source as Ref<any>).value
  }
  else if (isReactiveSource) {
    getter = () => source as any
  }
  else {
    throw new Error('无效的 watch 源')
  }

  return {
    getter,
    isMultiSource,
    isReactiveSource,
  }
}

export function applyDeepWatchGetter(
  getter: () => any,
  source: WatchSources<any>,
  isMultiSource: boolean,
  isReactiveSource: boolean,
  deepOption: boolean | number | undefined,
) {
  const deepDefault = isMultiSource
    ? (source as ReadonlyArray<WatchSource<any> | object>).some(item => isReactive(item))
    : isReactiveSource
  const deep = deepOption ?? deepDefault
  const shouldDeep = deep === true || typeof deep === 'number'
  if (!shouldDeep) {
    return getter
  }
  const depth = typeof deep === 'number' ? deep : (deep ? Infinity : 0)
  return () => {
    const value = getter()
    const strategy = getDeepWatchStrategy()
    if (isMultiSource && Array.isArray(value)) {
      return value.map((item) => {
        if (strategy === 'version' && isReactive(item)) {
          touchReactive(item as any)
          return item
        }
        return traverse(item, depth)
      })
    }
    if (strategy === 'version' && isReactive(value)) {
      touchReactive(value as any)
      return value
    }
    return traverse(value, depth)
  }
}

export function dispatchScheduledJob(
  job: () => void,
  flush: 'pre' | 'post' | 'sync',
  isFirstRun: boolean,
  scheduler?: WatchScheduler,
) {
  if (scheduler) {
    scheduler(job, isFirstRun)
    return
  }
  if (flush === 'sync') {
    job()
    return
  }
  if (flush === 'post') {
    nextTick(() => queueJob(job))
    return
  }
  if (isFirstRun) {
    job()
  }
  else {
    queueJob(job)
  }
}

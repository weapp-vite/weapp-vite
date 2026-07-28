import type { DefineComponentOptions } from '../types'

type ComponentOptions = DefineComponentOptions<any, any, any, any, any>
type OptionRecord = Record<string, any>

const OBJECT_OPTION_KEYS = [
  'components',
  'computed',
  'directives',
  'inject',
  'methods',
  'props',
  'provide',
] as const

const HOOK_OPTION_KEYS = new Set([
  'activated',
  'attached',
  'beforeCreate',
  'beforeDestroy',
  'beforeMount',
  'beforeUnmount',
  'beforeUpdate',
  'created',
  'deactivated',
  'destroyed',
  'detached',
  'errorCaptured',
  'hide',
  'mounted',
  'moved',
  'onAddToFavorites',
  'onHide',
  'onLoad',
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onReady',
  'onResize',
  'onRouteDone',
  'onSaveExitState',
  'onShareAppMessage',
  'onShareTimeline',
  'onShow',
  'onTabItemTap',
  'onUnload',
  'ready',
  'renderTracked',
  'renderTriggered',
  'serverPrefetch',
  'show',
  'unmounted',
  'updated',
])

function asRecord(value: unknown): OptionRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as OptionRecord
    : undefined
}

function mergeHook(parent: unknown, child: unknown) {
  if (typeof parent !== 'function') {
    return child
  }
  if (typeof child !== 'function') {
    return parent
  }
  return function mergedOptionHook(this: unknown, ...args: unknown[]) {
    parent.apply(this, args)
    return child.apply(this, args)
  }
}

function mergeHookRecord(parent: unknown, child: unknown) {
  const parentRecord = asRecord(parent)
  const childRecord = asRecord(child)
  if (!parentRecord) {
    return childRecord
  }
  if (!childRecord) {
    return parentRecord
  }
  const merged = { ...parentRecord, ...childRecord }
  for (const key of new Set([...Object.keys(parentRecord), ...Object.keys(childRecord)])) {
    merged[key] = mergeHook(parentRecord[key], childRecord[key])
  }
  return merged
}

function mergeData(parent: unknown, child: unknown) {
  if (parent === undefined) {
    return child
  }
  if (child === undefined) {
    return parent
  }
  return function mergedOptionData(this: unknown) {
    const parentData = typeof parent === 'function' ? parent.call(this) : parent
    const childData = typeof child === 'function' ? child.call(this) : child
    return {
      ...(asRecord(parentData) ?? {}),
      ...(asRecord(childData) ?? {}),
    }
  }
}

function resolveWatchHandler(descriptor: unknown, context: OptionRecord): ((...args: unknown[]) => unknown) | undefined {
  if (typeof descriptor === 'function') {
    return descriptor as (...args: unknown[]) => unknown
  }
  if (typeof descriptor === 'string') {
    const method = context[descriptor]
    return typeof method === 'function' ? method : undefined
  }
  const record = asRecord(descriptor)
  return record ? resolveWatchHandler(record.handler, context) : undefined
}

function mergeWatchDescriptor(parent: unknown, child: unknown) {
  if (parent === undefined) {
    return child
  }
  if (child === undefined) {
    return parent
  }
  const parentRecord = asRecord(parent)
  const childRecord = asRecord(child)
  return {
    ...(parentRecord ?? {}),
    ...(childRecord ?? {}),
    handler(this: OptionRecord, ...args: unknown[]) {
      resolveWatchHandler(parent, this)?.apply(this, args)
      return resolveWatchHandler(child, this)?.apply(this, args)
    },
    immediate: Boolean(parentRecord?.immediate || childRecord?.immediate),
    deep: Boolean(parentRecord?.deep || childRecord?.deep),
  }
}

function mergeWatch(parent: unknown, child: unknown) {
  const parentRecord = asRecord(parent)
  const childRecord = asRecord(child)
  if (!parentRecord) {
    return childRecord
  }
  if (!childRecord) {
    return parentRecord
  }
  const merged = { ...parentRecord, ...childRecord }
  for (const key of new Set([...Object.keys(parentRecord), ...Object.keys(childRecord)])) {
    merged[key] = mergeWatchDescriptor(parentRecord[key], childRecord[key])
  }
  return merged
}

function mergeArray(parent: unknown, child: unknown) {
  const values = [
    ...(Array.isArray(parent) ? parent : []),
    ...(Array.isArray(child) ? child : []),
  ]
  return [...new Set(values)]
}

function mergeOptions(parent: OptionRecord, child: OptionRecord) {
  const merged: OptionRecord = { ...parent, ...child }

  for (const key of OBJECT_OPTION_KEYS) {
    const parentRecord = asRecord(parent[key])
    const childRecord = asRecord(child[key])
    if (parentRecord || childRecord) {
      merged[key] = { ...(parentRecord ?? {}), ...(childRecord ?? {}) }
    }
  }

  merged.data = mergeData(parent.data, child.data)
  merged.watch = mergeWatch(parent.watch, child.watch)
  merged.lifetimes = mergeHookRecord(parent.lifetimes, child.lifetimes)
  merged.pageLifetimes = mergeHookRecord(parent.pageLifetimes, child.pageLifetimes)

  for (const key of new Set([...Object.keys(parent), ...Object.keys(child)])) {
    if (HOOK_OPTION_KEYS.has(key)) {
      merged[key] = mergeHook(parent[key], child[key])
    }
  }

  if (Array.isArray(parent.emits) || Array.isArray(child.emits)) {
    merged.emits = mergeArray(parent.emits, child.emits)
  }
  if (Array.isArray(parent.expose) || Array.isArray(child.expose)) {
    merged.expose = mergeArray(parent.expose, child.expose)
  }
  return merged
}

function appendOptions(target: OptionRecord, source: unknown, seen: WeakSet<object>) {
  const sourceRecord = asRecord(source)
  if (!sourceRecord || seen.has(sourceRecord)) {
    return target
  }
  seen.add(sourceRecord)

  let merged = target
  merged = appendOptions(merged, sourceRecord.extends, seen)
  if (Array.isArray(sourceRecord.mixins)) {
    for (const mixin of sourceRecord.mixins) {
      merged = appendOptions(merged, mixin, seen)
    }
  }

  const {
    extends: _extends,
    mixins: _mixins,
    ...ownOptions
  } = sourceRecord
  return mergeOptions(merged, ownOptions)
}

/**
 * 将 Vue Options API 的 extends/mixins 展开为单一组件选项。
 */
export function resolveVueComponentOptions<T extends ComponentOptions>(options: T): T {
  return appendOptions({}, options, new WeakSet()) as T
}

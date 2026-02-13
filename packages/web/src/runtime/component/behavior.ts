import type {
  ComponentOptions,
  ComponentPublicInstance,
  DataRecord,
  LifeTimeHooks,
  PageLifeTimeHooks,
} from './types'

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeLifetimes(target: LifeTimeHooks, source?: LifeTimeHooks) {
  if (!source) {
    return
  }
  const keys: Array<keyof LifeTimeHooks> = ['created', 'attached', 'ready', 'detached']
  for (const key of keys) {
    const next = source[key]
    if (!next) {
      continue
    }
    const current = target[key]
    target[key] = current
      ? function merged(this: ComponentPublicInstance) {
        current.call(this)
        next.call(this)
      }
      : next
  }
}

function mergePageLifetimes(target: PageLifeTimeHooks, source?: PageLifeTimeHooks) {
  if (!source) {
    return
  }
  const keys: Array<keyof PageLifeTimeHooks> = ['show', 'hide', 'resize']
  for (const key of keys) {
    const next = source[key]
    if (!next) {
      continue
    }
    const current = target[key]
    target[key] = current
      ? function merged(this: ComponentPublicInstance) {
        current.call(this)
        next.call(this)
      }
      : next
  }
}

export function normalizeBehaviors(component: ComponentOptions | undefined) {
  if (!component) {
    return { component: undefined, warnings: [] as string[] }
  }
  const warnings: string[] = []
  const visited = new Set<ComponentOptions>()
  const merged: ComponentOptions = {}

  const mergeComponent = (source: ComponentOptions) => {
    if (source.properties) {
      merged.properties = { ...(merged.properties ?? {}), ...source.properties }
    }
    if (source.data) {
      const nextData = typeof source.data === 'function'
        ? source.data()
        : source.data
      if (isPlainObject(nextData)) {
        merged.data = { ...((merged.data as DataRecord) ?? {}), ...nextData }
      }
    }
    if (source.methods) {
      merged.methods = { ...(merged.methods ?? {}), ...source.methods }
    }
    if (source.lifetimes) {
      merged.lifetimes = merged.lifetimes ?? {}
      mergeLifetimes(merged.lifetimes, source.lifetimes)
    }
    if (source.pageLifetimes) {
      merged.pageLifetimes = merged.pageLifetimes ?? {}
      mergePageLifetimes(merged.pageLifetimes, source.pageLifetimes)
    }
  }

  const walk = (source: ComponentOptions) => {
    if (visited.has(source)) {
      warnings.push('[@weapp-vite/web] behaviors 存在循环引用，已跳过。')
      return
    }
    visited.add(source)
    const behaviors = source.behaviors ?? []
    if (Array.isArray(behaviors)) {
      for (const behavior of behaviors) {
        if (!behavior || !isPlainObject(behavior)) {
          warnings.push('[@weapp-vite/web] behaviors 仅支持对象，已忽略非对象条目。')
          continue
        }
        walk(behavior as ComponentOptions)
        mergeComponent(behavior as ComponentOptions)
      }
    }
    else if (behaviors) {
      warnings.push('[@weapp-vite/web] behaviors 仅支持数组，已忽略。')
    }
  }

  walk(component)
  mergeComponent(component)

  return {
    component: merged,
    warnings,
  }
}

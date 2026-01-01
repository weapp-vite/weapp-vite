import type { ComputedRef } from '../reactivity'
import type { ModelBinding, ModelBindingOptions } from './types'
import { isRef } from '../reactivity'
import { capitalize, toPathSegments } from '../utils'

function setComputedValue(
  setters: Record<string, (value: any) => void>,
  key: string,
  value: any,
) {
  const setter = setters[key]
  if (!setter) {
    throw new Error(`Computed property "${key}" is readonly`)
  }
  setter(value)
}

function setWithSegments(
  target: Record<string, any>,
  segments: string[],
  value: any,
) {
  let current = target
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[segments[segments.length - 1]] = value
}

function setByPath(
  state: Record<string, any>,
  computedRefs: Record<string, ComputedRef<any>>,
  computedSetters: Record<string, (value: any) => void>,
  segments: string[],
  value: any,
) {
  if (!segments.length) {
    return
  }
  const [head, ...rest] = segments
  if (!rest.length) {
    if (computedRefs[head]) {
      setComputedValue(computedSetters, head, value)
    }
    else {
      const current = state[head]
      if (isRef(current)) {
        current.value = value
      }
      else {
        state[head] = value
      }
    }
    return
  }
  if (computedRefs[head]) {
    setComputedValue(computedSetters, head, value)
    return
  }
  if (state[head] == null || typeof state[head] !== 'object') {
    state[head] = {}
  }
  setWithSegments(state[head], rest, value)
}

function getFromPath(target: any, segments: string[]) {
  return segments.reduce((acc, segment) => {
    if (acc == null) {
      return acc
    }
    return acc[segment]
  }, target)
}

export function defaultParser(event: any) {
  if (event == null) {
    return event
  }
  if (typeof event === 'object') {
    if ('detail' in event && event.detail && 'value' in event.detail) {
      return event.detail.value
    }
    if ('target' in event && event.target && 'value' in event.target) {
      return event.target.value
    }
  }
  return event
}

export function createBindModel(
  publicInstance: Record<string, any>,
  state: Record<string, any>,
  computedRefs: Record<string, ComputedRef<any>>,
  computedSetters: Record<string, (value: any) => void>,
) {
  const bindModel = <T = any>(path: string, bindingOptions?: ModelBindingOptions<T>): ModelBinding<T> => {
    const segments = toPathSegments(path)
    if (!segments.length) {
      throw new Error('bindModel requires a non-empty path')
    }
    const resolveValue = () => getFromPath(publicInstance, segments)
    const assignValue = (value: T) => {
      setByPath(state as Record<string, any>, computedRefs, computedSetters, segments, value)
    }
    const defaultOptions: Required<ModelBindingOptions<T>> = {
      event: 'input',
      valueProp: 'value',
      parser: defaultParser,
      formatter: value => value,
      ...bindingOptions,
    }

    return {
      get value() {
        return resolveValue()
      },
      set value(nextValue: T) {
        assignValue(nextValue)
      },
      update(nextValue: T) {
        assignValue(nextValue)
      },
      model(modelOptions?: ModelBindingOptions<T>) {
        const merged = {
          ...defaultOptions,
          ...modelOptions,
        }
        const handlerKey = `on${capitalize(merged.event)}`
        const payload = {
          [merged.valueProp]: merged.formatter(resolveValue()),
        } as Record<string, any>
        payload[handlerKey] = (event: any) => {
          const parsed = merged.parser(event)
          assignValue(parsed)
        }
        return payload
      },
    }
  }
  return bindModel
}

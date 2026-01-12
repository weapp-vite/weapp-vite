import type { ComputedRef } from '../reactivity'
import type { ModelBinding, ModelBindingOptions, ModelBindingPayload } from './types'
import { isRef } from '../reactivity'
import { capitalize, toPathSegments } from '../utils'
import { parseModelEventValue, setComputedValue } from './internal'

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
  return parseModelEventValue(event)
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
      throw new Error('bindModel 需要非空路径')
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
      model<Event extends string = 'input', ValueProp extends string = 'value', Formatted = T>(
        modelOptions?: ModelBindingOptions<T, Event, ValueProp, Formatted>,
      ): ModelBindingPayload<T, Event, ValueProp, Formatted> {
        const merged = {
          ...defaultOptions,
          ...modelOptions,
        } as Required<ModelBindingOptions<T, Event, ValueProp, Formatted>>
        const handlerKey = `on${capitalize(merged.event)}`
        const payload = {
          [merged.valueProp]: merged.formatter(resolveValue()),
        } as ModelBindingPayload<T, Event, ValueProp, Formatted>
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

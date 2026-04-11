import type { Ref, ShallowRef } from '../../reactivity'
import type { InternalRuntimeState, TemplateRefs } from '../types'
import { WEVU_TEMPLATE_REF_MAP_KEY } from '@weapp-core/constants'
import { shallowRef } from '../../reactivity'
import { getCurrentInstance } from '../hooks'

type TemplateRefMap = Map<string, Ref<any>>

function ensureTemplateRefMap(target: InternalRuntimeState): TemplateRefMap {
  const existing = (target as any)[WEVU_TEMPLATE_REF_MAP_KEY] as TemplateRefMap | undefined
  if (existing) {
    return existing
  }
  const next = new Map<string, Ref<any>>()
  try {
    Object.defineProperty(target, WEVU_TEMPLATE_REF_MAP_KEY, {
      value: next,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(target as any)[WEVU_TEMPLATE_REF_MAP_KEY] = next
  }
  return next
}

export type TemplateRef<T = unknown> = Readonly<ShallowRef<T | null>>

export function useTemplateRef<K extends keyof TemplateRefs>(name: K): TemplateRef<TemplateRefs[K]>
export function useTemplateRef<T = unknown>(name: string): TemplateRef<T>
export function useTemplateRef<T = unknown>(name: string): TemplateRef<T> {
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('useTemplateRef() 必须在 setup() 的同步阶段调用')
  }
  const normalized = typeof name === 'string' ? name.trim() : ''
  if (!normalized) {
    throw new Error('useTemplateRef() 需要传入有效的模板 ref 名称')
  }
  const map = ensureTemplateRefMap(instance)
  const existing = map.get(normalized)
  if (existing) {
    return existing as TemplateRef<T>
  }
  const target = shallowRef<T | null>(null)
  map.set(normalized, target)
  return target as TemplateRef<T>
}

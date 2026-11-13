import type { HeadlessComponentDefinition, HeadlessComponentInstance } from './types'
import { isInvalidStringPropertyNull } from './properties'

const diagnostics = new WeakMap<HeadlessComponentInstance, { label: string, warn: (message: string) => void, invalidKeys: Set<string> }>()

/** 使用会话所属的 console，避免将属性警告写入另一运行时。 */
export function attachComponentPropertyDiagnostics(instance: HeadlessComponentInstance, label: string, warn: (message: string) => void) {
  diagnostics.set(instance, { label, warn, invalidKeys: new Set() })
}

/** 重复渲染不重复交付同一空属性；值恢复有效后允许下一次空值发出警告。 */
export function reportComponentPropertyValue(instance: HeadlessComponentInstance, definition: HeadlessComponentDefinition, key: string, value: unknown) {
  const state = diagnostics.get(instance)
  if (!state) {
    return
  }
  if (!isInvalidStringPropertyNull(definition, key, value)) {
    state.invalidKeys.delete(key)
    return
  }
  if (!state.invalidKeys.has(key)) {
    state.invalidKeys.add(key)
    state.warn(`[Component] property "${key}" of "${state.label}" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`)
  }
}

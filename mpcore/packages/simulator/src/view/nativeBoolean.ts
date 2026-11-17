import type { HeadlessNativeNode } from './nativeNode'

interface NativeBooleanValue {
  value: unknown
  valueless: boolean
}

export type NativeBooleanSnapshot = ReadonlyMap<string, NativeBooleanValue>

const nativeBooleanValues = new WeakMap<object, Map<string, NativeBooleanValue>>()

/** 保留原始布尔属性值，避免 null/undefined 在属性序列化后退化为裸属性。 */
export function setNativeBooleanValue(node: HeadlessNativeNode, name: string, value: unknown, valueless = false) {
  if (name !== 'checked' && name !== 'disabled') {
    return
  }
  let values = nativeBooleanValues.get(node)
  if (!values) {
    values = new Map()
    nativeBooleanValues.set(node, values)
  }
  values.set(name, { value, valueless })
}

export function getNativeBooleanValue(node: HeadlessNativeNode, name: string): boolean {
  const attributes = node.attribs
  if (!attributes || !Object.hasOwn(attributes, name)) {
    return false
  }
  const snapshot = (node as HeadlessNativeNode & { nativeBooleanValues?: NativeBooleanSnapshot }).nativeBooleanValues
  const stored = nativeBooleanValues.get(node)?.get(name) ?? snapshot?.get(name)
  if (stored) {
    if (stored.valueless) {
      return true
    }
    return stored.value !== undefined
      && stored.value !== null
      && stored.value !== false
      && stored.value !== 0
      && stored.value !== ''
      && stored.value !== 'false'
      && stored.value !== '0'
  }
  const value = attributes[name]
  return value !== 'false' && value !== '0'
}

export function getNativeBooleanSnapshot(node: object): NativeBooleanSnapshot | undefined {
  return nativeBooleanValues.get(node)
}

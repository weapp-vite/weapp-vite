import type { ControlledReader, ControlledScope } from './dependencies'
import { commitControlledBinding, createControlledBinding, releaseControlledBinding } from './state'

interface LegacyControlledValue {
  name: string
  read: ControlledReader
  scope: ControlledScope
}

const values = new WeakMap<object, LegacyControlledValue[]>()
const owned = new WeakMap<object, Map<Element, Map<string, ReturnType<typeof createControlledBinding>>>>()

export function recordLegacyControlledValue(token: object, name: string, read: ControlledReader, scope: ControlledScope) {
  const attributes = values.get(token) ?? []
  attributes.push({ name, read, scope })
  values.set(token, attributes)
}

export function hasLegacyControlledValues(token: object) {
  return Boolean(values.get(token)?.length)
}

/** 复用兼容模板的节点锚点；相同 HTML 仍能承接显式相等值提交。 */
export function commitLegacyControlledValues(context: object, records: Array<{ element: Element, token: object }>) {
  const previous = owned.get(context) ?? new Map()
  const current = new Map<Element, Map<string, ReturnType<typeof createControlledBinding>>>()
  for (const { element, token } of records) {
    const attributes = new Map<string, ReturnType<typeof createControlledBinding>>()
    for (const { name, read, scope } of values.get(token) ?? []) {
      const binding = previous.get(element)?.get(name) ?? createControlledBinding(context, element, name)
      previous.get(element)?.delete(name)
      commitControlledBinding(binding, read, scope)
      attributes.set(name, binding)
    }
    if (attributes.size) {
      current.set(element, attributes)
    }
  }
  for (const attributes of previous.values()) {
    for (const binding of attributes.values()) {
      releaseControlledBinding(binding)
    }
  }
  owned.set(context, current)
}

export function releaseLegacyControlledValues(context: object) {
  commitLegacyControlledValues(context, [])
  owned.delete(context)
}

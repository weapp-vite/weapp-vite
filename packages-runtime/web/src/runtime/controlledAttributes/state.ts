import type { ControlledDataPath, ControlledReader, ControlledScope } from './dependencies'
import { pathsIntersect, readControlledValue } from './dependencies'

interface ControlledBinding {
  context: object
  element: Element
  name: string
  paths: ControlledDataPath[]
  pending: boolean
}

const bindings = new WeakMap<object, Set<ControlledBinding>>()
const targets = new WeakMap<Element, Map<string, (value: unknown) => void>>()

/** 控件只注册受控提交回调，数据和模板层不需要了解控件内部状态机。 */
export function registerControlledAttributeCommit(element: Element, name: string, commit: (value: unknown) => void) {
  let attributes = targets.get(element)
  if (!attributes) {
    attributes = new Map()
    targets.set(element, attributes)
  }
  attributes.set(name, commit)
  return () => {
    if (attributes.get(name) === commit) {
      attributes.delete(name)
    }
    if (attributes.size === 0) {
      targets.delete(element)
    }
  }
}

export function createControlledBinding(context: object, element: Element, name: string): ControlledBinding {
  const binding = { context, element, name, paths: [], pending: false }
  let owned = bindings.get(context)
  if (!owned) {
    owned = new Set()
    bindings.set(context, owned)
  }
  owned.add(binding)
  return binding
}

export function releaseControlledBinding(binding: ControlledBinding) {
  bindings.get(binding.context)?.delete(binding)
}

/** 即使值相等，也只通知依赖路径相交的受控绑定。 */
export function recordControlledDataCommit(context: object, paths: ControlledDataPath[]) {
  let affected = false
  for (const binding of bindings.get(context) ?? []) {
    if (binding.paths.some(dependency => paths.some(path => pathsIntersect(dependency, path)))) {
      binding.pending = true
      affected = true
    }
  }
  return affected
}

export function commitControlledBinding(binding: ControlledBinding, read: ControlledReader, scope: ControlledScope) {
  const context = binding.context as { instance?: { data?: ControlledScope } }
  const result = readControlledValue(read, scope, context.instance?.data ?? scope)
  binding.paths = result.paths
  const pending = binding.pending
  binding.pending = false
  const previous = binding.element.getAttribute(binding.name)
  const next = result.value == null ? null : String(result.value)
  if (previous !== next) {
    if (next === null) {
      binding.element.removeAttribute(binding.name)
    }
    else {
      binding.element.setAttribute(binding.name, next)
    }
  }
  else if (pending) {
    targets.get(binding.element)?.get(binding.name)?.(result.value)
  }
}

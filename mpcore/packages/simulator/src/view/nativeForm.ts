import type { HeadlessNativeNode } from './nativeNode'
import type { HeadlessTestingNodeEventInit } from './nodeHandle'
import { cloneProtocolValue } from '../testing/sessionHandle/shared'
import { getNativeNodeOwner } from './componentEvent'
import { createMiniProgramEventPayload, resolveMiniProgramEventBinding } from './eventBinding'
import { getNativeBooleanValue } from './nativeBoolean'

export interface NativeFormComponent {
  definition: { behaviors?: unknown }
  ownerScopeId: string | null
  name?: string
  value?: unknown
}

export type ResolveNativeFormComponent = (scopeId: string) => NativeFormComponent | undefined

type ResolveMethod = (scopeId: string | null, method: string) => (event: Record<string, unknown>) => unknown

const pickerValues = new WeakMap<HeadlessNativeNode, unknown>()

/** 保存 picker 的原始数组属性，不能从渲染后的逗号字符串反推选项值。 */
export function setNativePickerValue(node: HeadlessNativeNode, value: unknown) {
  if (node.name === 'picker') {
    pickerValues.set(node, value)
  }
}

function includesBehavior(definition: { behaviors?: unknown }, name: string, visited = new Set<object>()): boolean {
  if (visited.has(definition)) {
    return false
  }
  visited.add(definition)
  return Array.isArray(definition.behaviors) && definition.behaviors.some(behavior => behavior === name
    || (behavior !== null && typeof behavior === 'object' && includesBehavior(behavior, name, visited)))
}

function nativeOwner(node: HeadlessNativeNode) {
  return getNativeNodeOwner(node) ?? { scopeId: node.attribs?.['data-sim-scope'] ?? null, target: node }
}

function participatingScopes(formScope: string | null, pageScope: string, resolveComponent?: ResolveNativeFormComponent) {
  const scopes = new Set<string | null>([null, pageScope])
  let current = formScope
  while (current && !scopes.has(current)) {
    scopes.add(current)
    current = resolveComponent?.(current)?.ownerScopeId ?? null
  }
  return scopes
}

function participates(scopeId: string | null, formScopes: ReadonlySet<string | null>, behavior: string, resolveComponent?: ResolveNativeFormComponent): boolean {
  const visited = new Set<string>()
  while (!formScopes.has(scopeId)) {
    if (!scopeId || visited.has(scopeId)) {
      return false
    }
    visited.add(scopeId)
    const component = resolveComponent?.(scopeId)
    if (!component || !includesBehavior(component.definition, behavior)) {
      return false
    }
    scopeId = component.ownerScopeId
  }
  return true
}

function participatesFormField(scopeId: string | null, formScopes: ReadonlySet<string | null>, resolveComponent?: ResolveNativeFormComponent): boolean {
  const visited = new Set<string>()
  while (!formScopes.has(scopeId)) {
    if (!scopeId || visited.has(scopeId)) {
      return false
    }
    visited.add(scopeId)
    const component = resolveComponent?.(scopeId)
    if (!component || (!includesBehavior(component.definition, 'wx://form-field')
      && !includesBehavior(component.definition, 'wx://form-field-group'))) {
      return false
    }
    scopeId = component.ownerScopeId
  }

  return true
}
function resolveFormFieldComponent(scopeId: string | null, resolveComponent?: ResolveNativeFormComponent) {
  const visited = new Set<string>()
  let current = scopeId
  while (current && !visited.has(current)) {
    visited.add(current)
    const component = resolveComponent?.(current)
    if (!component) {
      return undefined
    }
    if (includesBehavior(component.definition, 'wx://form-field')) {
      return { scopeId: current, component }
    }
    current = component.ownerScopeId
  }
  return undefined
}

function checked(node: HeadlessNativeNode, name: string) {
  return getNativeBooleanValue(node, name)
}

function choiceValues(group: HeadlessNativeNode, pageScope: string, resolveComponent?: ResolveNativeFormComponent) {
  const values: string[] = []
  const scopes = participatingScopes(nativeOwner(group).scopeId, pageScope, resolveComponent)
  const choice = group.name === 'radio-group' ? 'radio' : 'checkbox'
  const visit = (node: HeadlessNativeNode) => {
    if (node.name === 'form' || node.name === 'radio-group' || node.name === 'checkbox-group') {
      return
    }
    if (node.name === choice) {
      const owner = nativeOwner(node)
      if (checked(owner.target, 'checked') && participates(owner.scopeId, scopes, 'wx://form-field-group', resolveComponent)) {
        values.push(owner.target.attribs?.value ?? '')
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  for (const child of group.children ?? []) {
    visit(child)
  }
  return values
}

function collectFormValues(form: HeadlessNativeNode, scopes: ReadonlySet<string | null>, pageScope: string, resolveComponent?: ResolveNativeFormComponent) {
  const values: Record<string, unknown> = Object.create(null)
  const visit = (node: HeadlessNativeNode) => {
    if (node.name === 'form') {
      return
    }
    const owner = nativeOwner(node)
    const attributes = owner.target.attribs
    const field = resolveFormFieldComponent(owner.scopeId, resolveComponent)
    const componentName = field?.component.name
    if (typeof componentName === 'string' && componentName && node.attribs?.['data-sim-component']
      && field && participatesFormField(field.scopeId, scopes, resolveComponent)) {
      values[componentName] = cloneProtocolValue(field.component.value)
      return
    }
    const name = attributes?.name
    if (attributes && name && participates(owner.scopeId, scopes, 'wx://form-field-group', resolveComponent)) {
      switch (node.name) {
        case 'input':
        case 'textarea':
          values[name] = attributes.value ?? ''
          break
        case 'switch':
          values[name] = checked(owner.target, 'checked')
          break
        case 'slider':
          values[name] = Number(attributes.value ?? 0)
          break
        case 'picker': {
          const mode = attributes.mode ?? 'selector'
          if (mode === 'multiSelector' || mode === 'region') {
            const value = pickerValues.get(node)
            values[name] = Array.isArray(value) ? value.slice() : []
          }
          else {
            values[name] = mode === 'selector' ? Number(attributes.value ?? 0) : attributes.value ?? ''
          }
          break
        }
        case 'radio-group':
          values[name] = choiceValues(node, pageScope, resolveComponent)[0] ?? ''
          break
        case 'checkbox-group':
          values[name] = choiceValues(node, pageScope, resolveComponent)
          break
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  for (const child of form.children ?? []) {
    visit(child)
  }
  return values
}

/** 先固定提交目标、字段值和方法所有者，再允许 tap 回调改变组件树。 */
export function prepareNativeFormSubmit(
  button: HeadlessNativeNode,
  pageScope: string,
  event: HeadlessTestingNodeEventInit,
  resolveMethod: ResolveMethod,
  resolveComponent?: ResolveNativeFormComponent,
) {
  const owner = nativeOwner(button)
  if (owner.target.attribs?.['form-type'] !== 'submit' || checked(owner.target, 'disabled')) {
    return undefined
  }
  let form = button.parent
  while (form && form.name !== 'form') {
    form = form.parent
  }
  if (!form) {
    return undefined
  }
  const formOwner = nativeOwner(form)
  const scopes = participatingScopes(formOwner.scopeId, pageScope, resolveComponent)
  if (!participates(owner.scopeId, scopes, 'wx://form-field-button', resolveComponent)) {
    return undefined
  }
  const binding = resolveMiniProgramEventBinding(formOwner.target.attribs, 'submit')
  return {
    call: binding?.method ? resolveMethod(formOwner.scopeId, binding.method) : undefined,
    event: createMiniProgramEventPayload(formOwner.target, 'submit', {
      detail: { value: collectFormValues(form, scopes, pageScope, resolveComponent) },
      mark: event.mark,
    }),
  }
}

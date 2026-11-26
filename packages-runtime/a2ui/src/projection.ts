/* eslint-disable ts/no-use-before-define -- 节点投影与值转换互递归，函数声明由模块初始化提升。 */
import type { NodeAction } from '@a2ui/web_core/resolution'
import type { A2uiNode, A2uiPropValue } from './types'
import { getValue } from '@a2ui/web_core/reactivity'
import { isComponentNode, ResolvedBinding, WritableBinding } from '@a2ui/web_core/resolution'

/** 节点上可回写的数据绑定与可执行动作；按属性名收集，避免静默选择第一项。 */
export interface A2uiNodeOperation {
  readonly inputs: ReadonlyMap<string, WritableBinding<unknown>>
  readonly actions: ReadonlyMap<string, NodeAction>
}

export interface A2uiProjectedSurface {
  readonly root: A2uiNode | null
  readonly operations: Map<string, A2uiNodeOperation>
}

/**
 * 把 Core 解析出的节点树投影为组件无关的 JSON 树。
 *
 * 直接子节点按属性出现顺序收集到 children；对象或数组深处的槽位节点保留在 props 中。
 * 一个组件可以同时声明多个输入绑定与动作。
 */
export function projectA2uiSurface(root: unknown, generation: number): A2uiProjectedSurface {
  const operations = new Map<string, A2uiNodeOperation>()
  return { root: projectNode(root, operations, generation), operations }
}

function projectNode(value: unknown, operations: Map<string, A2uiNodeOperation>, generation: number): A2uiNode | null {
  if (!isComponentNode(value) || value.disposed || value.isPlaceholder) {
    return null
  }
  const id = `${value.id}-v${generation}`
  const props: Record<string, A2uiPropValue> = {}
  const children: A2uiNode[] = []
  const actionNames: string[] = []
  const inputs = new Map<string, WritableBinding<unknown>>()
  const actions = new Map<string, NodeAction>()
  for (const [name, raw] of Object.entries(getValue(value.props))) {
    if (isComponentNode(raw)) {
      const child = projectNode(raw, operations, generation)
      if (child) {
        children.push(child)
      }
      continue
    }
    if (Array.isArray(raw) && raw.length > 0 && raw.every(isComponentNode)) {
      for (const item of raw) {
        const child = projectNode(item, operations, generation)
        if (child) {
          children.push(child)
        }
      }
      continue
    }
    if (typeof raw === 'function') {
      actionNames.push(name)
      actions.set(name, raw as NodeAction)
      continue
    }
    if (raw instanceof WritableBinding) {
      inputs.set(name, raw as WritableBinding<unknown>)
      props[name] = toA2uiPropValue(raw.value, operations, generation) ?? null
      continue
    }
    if (raw instanceof ResolvedBinding) {
      props[name] = toA2uiPropValue(raw.value, operations, generation) ?? null
      continue
    }
    const converted = toA2uiPropValue(raw, operations, generation)
    if (converted !== undefined) {
      props[name] = converted
    }
  }
  if (inputs.size > 0 || actions.size > 0) {
    operations.set(id, { inputs, actions })
  }
  return { id, componentId: value.componentId, type: value.type, props, children, actions: actionNames }
}

function toA2uiPropValue(value: unknown, operations: Map<string, A2uiNodeOperation>, generation: number): A2uiPropValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (value instanceof ResolvedBinding) {
    return toA2uiPropValue(value.value, operations, generation)
  }
  if (isComponentNode(value)) {
    return projectNode(value, operations, generation) ?? null
  }
  if (Array.isArray(value)) {
    return value.map(item => toA2uiPropValue(item, operations, generation) ?? null)
  }
  if (typeof value === 'object') {
    const result: Record<string, A2uiPropValue> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const converted = toA2uiPropValue(item, operations, generation)
      if (converted !== undefined) {
        result[key] = converted
      }
    }
    return result
  }
  return undefined
}

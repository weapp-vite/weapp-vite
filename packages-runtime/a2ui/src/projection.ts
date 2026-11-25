/* eslint-disable ts/no-use-before-define -- 节点投影与值转换互递归，函数声明由模块初始化提升。 */
import type { NodeAction } from '@a2ui/web_core'
import type { A2uiJsonValue, A2uiNode } from './types'
import { getValue, isComponentNode, ResolvedBinding, WritableBinding } from '@a2ui/web_core'

/** 节点上可回写的数据绑定与可执行动作；按投影时的最新节点收集。 */
export interface A2uiNodeOperation {
  readonly input?: WritableBinding<unknown>
  readonly action?: NodeAction
  readonly actionNames: readonly string[]
}

export interface A2uiProjectedSurface {
  readonly root: A2uiNode | null
  readonly operations: Map<string, A2uiNodeOperation>
}

/**
 * 把 Core 解析出的节点树投影为组件无关的 JSON 树。
 *
 * 子节点按属性出现顺序收集：单节点属性与节点数组都视为子节点，不进入 props。
 * 一个组件同时声明输入绑定与动作时两者都会保留。
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
  const props: Record<string, A2uiJsonValue> = {}
  const children: A2uiNode[] = []
  const actionNames: string[] = []
  let input: WritableBinding<unknown> | undefined
  let action: NodeAction | undefined
  for (const [name, raw] of Object.entries(getValue(value.props))) {
    if (isComponentNode(raw)) {
      const child = projectNode(raw, operations, generation)
      if (child) {
        children.push(child)
      }
      continue
    }
    if (Array.isArray(raw) && raw.some(isComponentNode)) {
      for (const item of raw) {
        if (!isComponentNode(item)) {
          continue
        }
        const child = projectNode(item, operations, generation)
        if (child) {
          children.push(child)
        }
      }
      continue
    }
    if (typeof raw === 'function') {
      actionNames.push(name)
      action ??= raw as NodeAction
      continue
    }
    if (raw instanceof WritableBinding) {
      input ??= raw as WritableBinding<unknown>
      props[name] = toA2uiJsonValue(raw.value) ?? null
      continue
    }
    if (raw instanceof ResolvedBinding) {
      props[name] = toA2uiJsonValue(raw.value) ?? null
      continue
    }
    const converted = toA2uiJsonValue(raw)
    if (converted !== undefined) {
      props[name] = converted
    }
  }
  if (input || action || actionNames.length > 0) {
    operations.set(id, { input, action, actionNames })
  }
  return { id, componentId: value.componentId, type: value.type, props, children, actions: actionNames }
}

function toA2uiJsonValue(value: unknown): A2uiJsonValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (value instanceof ResolvedBinding) {
    return toA2uiJsonValue(value.value)
  }
  if (Array.isArray(value)) {
    return value.map(item => toA2uiJsonValue(item) ?? null)
  }
  if (typeof value === 'object') {
    if (isComponentNode(value)) {
      return value.componentId
    }
    const result: Record<string, A2uiJsonValue> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const converted = toA2uiJsonValue(item)
      if (converted !== undefined) {
        result[key] = converted
      }
    }
    return result
  }
  return undefined
}

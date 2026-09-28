import type { RendererCatalog, RendererLimits, RendererSpec, SpecElement } from './types'
import { z } from 'zod'
import { resolveElementProps } from './core'
import { assertJson, parsePointer } from './path'

const visibleSchema = z.union([z.boolean(), z.object({ $state: z.string(), not: z.literal(true).optional(), eq: z.unknown().optional() }).strict()])
const specSchema = z.object({
  root: z.string().min(1),
  elements: z.record(z.string().regex(/^[a-z][\w-]*$/i), z.object({
    type: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(z.string().min(1)).optional(),
    visible: visibleSchema.optional(),
    on: z.record(z.string(), z.object({ action: z.string(), params: z.record(z.string(), z.unknown()).optional() }).strict()).optional(),
  }).strict()),
}).strict()

/** v1 只解释状态读取和输入绑定，拒绝静默接受未实现的表达式。 */
function validateExpressions(value: unknown, binding = false) {
  if (!value || typeof value !== 'object') {
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$')) {
      if (!['$state', ...(binding ? ['$bindState'] : [])].includes(key)
        || Object.keys(value).length !== 1 || typeof child !== 'string') {
        throw new Error(`不支持的表达式：${key}`)
      }
      parsePointer(child)
    }
    else {
      validateExpressions(child)
    }
  }
}

export function resolveProps(node: SpecElement, catalog: RendererCatalog, state: object) {
  const resolved = resolveElementProps(node.props, { stateModel: state as Record<string, unknown> })
  const parsed: unknown = catalog.components[node.type]!.props.parse(resolved)
  assertJson(parsed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('组件 props schema 必须输出对象')
  }
  return parsed
}

/** 完整描述与流式中间态共用目录和图结构校验。 */
export function validateRendererSpec(
  input: unknown,
  catalog: RendererCatalog,
  state: object,
  limits: RendererLimits = {},
  partial = false,
): { spec: RendererSpec, complete: boolean } {
  assertJson(input)
  const spec = specSchema.parse(input) as RendererSpec
  const maxNodes = limits.maxNodes ?? 200
  const maxDepth = limits.maxDepth ?? 8
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || !Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error('节点及深度上限必须是正整数')
  }
  const ids = Object.keys(spec.elements)
  if (ids.length > maxNodes) {
    throw new Error(`节点数量不能超过 ${maxNodes}`)
  }
  const parents = new Set<string>()
  let complete = Object.prototype.hasOwnProperty.call(spec.elements, spec.root)
  for (const [id, node] of Object.entries(spec.elements)) {
    if (!Object.prototype.hasOwnProperty.call(catalog.components, node.type)) {
      throw new Error(`未注册组件：${node.type}`)
    }
    const definition = catalog.components[node.type]!
    if (!definition.container && node.children?.length) {
      throw new Error(`${node.type} 不支持 children`)
    }
    for (const [key, value] of Object.entries(node.props)) {
      validateExpressions(value, Object.prototype.hasOwnProperty.call(definition.bindings ?? {}, key))
    }
    if (typeof node.visible === 'object') {
      parsePointer(node.visible.$state)
    }
    resolveProps(node, catalog, state)
    for (const [event, action] of Object.entries(node.on ?? {})) {
      if (!definition.events?.includes(event)) {
        throw new Error(`${node.type} 未声明事件：${event}`)
      }
      if (!Object.prototype.hasOwnProperty.call(catalog.actions, action.action)) {
        throw new Error(`未注册动作：${action.action}`)
      }
      validateExpressions(action.params ?? {})
    }
    for (const child of node.children ?? []) {
      if (parents.has(child)) {
        throw new Error(`节点重复引用：${child}`)
      }
      parents.add(child)
    }
    parsePointer(`/elements/${id}`)
  }
  function visit(id: string, ancestors: Set<string>) {
    if (ancestors.has(id)) {
      throw new Error(`节点循环引用：${id}`)
    }
    if (ancestors.size >= maxDepth) {
      throw new Error(`节点深度不能超过 ${maxDepth}`)
    }
    if (!Object.prototype.hasOwnProperty.call(spec.elements, id)) {
      complete = false
      return
    }
    const next = new Set(ancestors).add(id)
    for (const child of spec.elements[id]!.children ?? []) {
      visit(child, next)
    }
  }
  ids.forEach(id => visit(id, new Set()))
  if (!partial && !complete) {
    throw new Error('节点引用不存在')
  }
  return { spec, complete }
}

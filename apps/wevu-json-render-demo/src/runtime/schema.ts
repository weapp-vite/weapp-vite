import { z } from 'zod'
import './compat'

const statePath = z.enum(['/form/reason', '/busy', '/status', '/error', '/submitted'])
const read = z.object({ $state: z.enum(['/form/reason', '/status', '/error']) }).strict()
const text = z.union([z.string(), read])
const flag = z.union([z.boolean(), z.object({ $state: z.enum(['/busy', '/submitted']) }).strict()])
const visible = z.union([
  z.boolean(),
  z.object({ $state: statePath, not: z.literal(true).optional(), eq: z.union([z.string(), z.boolean()]).optional() }).strict(),
])
const common = {
  children: z.array(z.string().min(1)).default([]),
  visible: visible.optional(),
}
const empty = z.object({}).strict()
const elementSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('Stack'), props: empty }).strict(),
  z.object({ ...common, type: z.literal('Card'), props: z.object({ title: text }).strict() }).strict(),
  z.object({ ...common, type: z.literal('Text'), props: z.object({ text }).strict() }).strict(),
  z.object({
    ...common,
    type: z.literal('Input'),
    props: z.object({ label: text, placeholder: text, value: z.object({ $bindState: z.literal('/form/reason') }).strict() }).strict(),
  }).strict(),
  z.object({
    ...common,
    type: z.literal('Button'),
    props: z.object({ label: text, disabled: flag.optional() }).strict(),
    on: z.object({ press: z.object({ action: z.literal('submit') }).strict() }).strict(),
  }).strict(),
  z.object({
    ...common,
    type: z.literal('OrderSummary'),
    props: z.object({ number: z.string(), product: z.string(), amount: z.string() }).strict(),
  }).strict(),
])

export const specSchema = z.object({
  root: z.string().min(1),
  elements: z.record(z.string().regex(/^[a-z][\w-]*$/i), elementSchema),
}).strict()

export type DemoSpec = z.infer<typeof specSchema>
export type DemoElement = DemoSpec['elements'][string]

/** 校验原型支持的协议子集；流式允许暂缺引用，但不会渲染不完整的树。 */
export function validateSpec(value: unknown, partial = false): { spec: DemoSpec, complete: boolean } {
  const spec = specSchema.parse(value)
  const ids = Object.keys(spec.elements)
  if (ids.length > 200) {
    throw new Error('节点数量不能超过 200')
  }
  let complete = Boolean(spec.elements[spec.root])
  const parents = new Set<string>()
  for (const node of Object.values(spec.elements)) {
    if (!['Stack', 'Card'].includes(node.type) && node.children.length) {
      throw new Error('只有 Stack 和 Card 支持 children')
    }
    for (const id of node.children) {
      if (parents.has(id)) {
        throw new Error(`节点重复引用：${id}`)
      }
      parents.add(id)
    }
  }
  function visit(id: string, ancestors: Set<string>) {
    if (ancestors.has(id)) {
      throw new Error(`节点循环引用：${id}`)
    }
    if (ancestors.size >= 8) {
      throw new Error('节点深度不能超过 8')
    }
    const node = spec.elements[id]
    if (!node) {
      complete = false
      return
    }
    const next = new Set([...ancestors, id])
    node.children.forEach(child => visit(child, next))
  }
  // 检查暂未接到 root 的节点，避免非法子树藏在流式中间状态。
  ids.forEach(id => visit(id, new Set()))
  if (!partial && !complete) {
    throw new Error('节点引用不存在')
  }
  return { spec, complete }
}

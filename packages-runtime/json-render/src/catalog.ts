import type { RendererCatalog } from './types'
import { z } from 'zod'
import './compat'

/** 保留组件、动作及其参数 schema 的类型推导。 */
export function defineRendererCatalog<const C extends RendererCatalog>(catalog: C): C {
  return catalog
}

export const standardComponents = {
  Stack: { props: z.object({}).strict(), container: true },
  Card: { props: z.object({ title: z.string() }).strict(), container: true },
  Text: { props: z.object({ text: z.string() }).strict() },
  Input: {
    props: z.object({ label: z.string(), placeholder: z.string(), value: z.string() }).strict(),
    events: ['input'],
    bindings: { value: 'input' },
  },
  Button: {
    props: z.object({ label: z.string(), disabled: z.boolean().optional() }).strict(),
    events: ['press'],
  },
} as const

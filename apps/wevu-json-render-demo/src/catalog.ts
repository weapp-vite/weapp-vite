import type { CatalogSpec } from '@wevu/json-render'
import { defineRendererCatalog, standardComponents } from '@wevu/json-render'
import { z } from 'zod'

// 消费端自建 schema 也关闭 JIT，不依赖预编译组件包中的另一份 Zod 实例。
z.config({ jitless: true })

export const catalog = defineRendererCatalog({
  components: {
    ...standardComponents,
    OrderSummary: { props: z.object({ number: z.string(), product: z.string(), amount: z.string() }).strict(), events: ['inspect'] },
  },
  actions: { submit: z.object({}).strict(), inspect: z.object({}).strict() },
})

export type DemoSpec = CatalogSpec<typeof catalog>
